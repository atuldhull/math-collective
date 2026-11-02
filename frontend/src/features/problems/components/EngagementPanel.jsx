/**
 * EngagementPanel — interest beacon + writeups block.
 *
 * Mounts under the "Resources" section on /problems/:slugOrId and
 * turns a read-only catalogue entry into a community board:
 *
 *   • Interest beacon — "I'm tackling this" toggle. Shows the
 *     total count and a small stack of recent-interest avatars so the
 *     viewer can SEE who else is working on this problem.
 *   • Writeup list   — markdown post-mortems other students have
 *     submitted, ordered by upvote count. Each card has an upvote
 *     toggle that updates the count optimistically.
 *   • Composer       — the viewer's own writeup (one per problem).
 *     Re-submit overwrites; "Remove" soft-deletes.
 *
 * One initial fetch (problems.engagement) populates the whole strip;
 * subsequent toggles are individual round-trips that update local
 * state in place. AbortController guards the initial fetch against
 * route changes.
 */

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowBigUp, ExternalLink, Flame, PenLine, Plus, Trash2 } from "lucide-react";
import { problems } from "@/lib/api";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import BookmarkButton from "@/components/ui/BookmarkButton";
import WriteupComments from "./WriteupComments";

export default function EngagementPanel({ slugOrId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);   // interest toggle in flight
  const [error,   setError]   = useState(null);

  // Composer state — controlled inputs, kept local so the parent
  // doesn't re-render on every keystroke.
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft,       setDraft]       = useState({ title: "", body: "", repo_url: "" });
  const [posting,     setPosting]     = useState(false);
  const [postError,   setPostError]   = useState(null);

  // Find my own writeup (if any) — used to seed the composer with
  // the existing record on edit, and to render the "Remove" button.
  const myWriteup = data?.writeups?.find((w) => w.is_mine) || null;

  // ── Initial fetch ────────────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    problems.engagement(slugOrId, { signal: ctrl.signal })
      .then(({ data }) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        setError(err?.response?.data?.error || "Couldn't load community panel");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [slugOrId]);

  // ── Toggle interest ──────────────────────────────────────────
  const onToggleInterest = useCallback(async () => {
    if (busy || !data) return;
    setBusy(true);
    // Optimistic — flip + adjust count immediately. Server response
    // is authoritative but the round trip can be 200ms+ on mobile.
    const before = data.i_am_interested;
    setData((d) => ({
      ...d,
      i_am_interested: !before,
      interest_count:  Math.max(0, (d.interest_count || 0) + (before ? -1 : 1)),
    }));
    try {
      const { data: resp } = await problems.toggleInterest(slugOrId);
      setData((d) => ({ ...d, i_am_interested: resp.i_am_interested }));
    } catch {
      // Roll back — server didn't confirm. Best-effort; if it 4xx'd
      // the user will see the old state and can try again.
      setData((d) => ({
        ...d,
        i_am_interested: before,
        interest_count:  Math.max(0, (d.interest_count || 0) + (before ? 1 : -1)),
      }));
    } finally {
      setBusy(false);
    }
  }, [busy, data, slugOrId]);

  // ── Vote on a writeup ────────────────────────────────────────
  const onVote = useCallback(async (writeupId) => {
    setData((d) => {
      if (!d) return d;
      return {
        ...d,
        writeups: d.writeups.map((w) =>
          w.id === writeupId
            ? { ...w, voted_by_me: !w.voted_by_me, vote_count: w.vote_count + (w.voted_by_me ? -1 : 1) }
            : w,
        ),
      };
    });
    try {
      const { data: resp } = await problems.voteWriteup(writeupId);
      setData((d) => ({
        ...d,
        writeups: d.writeups.map((w) =>
          w.id === writeupId ? { ...w, voted_by_me: resp.voted_by_me, vote_count: resp.vote_count } : w,
        ),
      }));
    } catch {
      // server rejected — roll back local optimistic flip
      setData((d) => ({
        ...d,
        writeups: d.writeups.map((w) =>
          w.id === writeupId
            ? { ...w, voted_by_me: !w.voted_by_me, vote_count: w.vote_count + (w.voted_by_me ? -1 : 1) }
            : w,
        ),
      }));
    }
  }, []);

  // ── Submit / update writeup ──────────────────────────────────
  const onSubmitWriteup = useCallback(async (e) => {
    e?.preventDefault();
    if (posting) return;
    if (!draft.title.trim() || !draft.body.trim()) {
      setPostError("Title and body are both required.");
      return;
    }
    setPosting(true);
    setPostError(null);
    try {
      const { data: row } = await problems.postWriteup(slugOrId, {
        title: draft.title.trim(),
        body:  draft.body.trim(),
        ...(draft.repo_url.trim() ? { repo_url: draft.repo_url.trim() } : {}),
      });
      // Splice into local state — replace existing "mine" row, else
      // prepend. Either way the list keeps its vote-ordered shape.
      setData((d) => {
        const rest = (d.writeups || []).filter((w) => !w.is_mine);
        return {
          ...d,
          writeups: [
            {
              id:            row.id,
              user_id:       row.user_id,
              title:         row.title,
              body:          row.body,
              repo_url:      row.repo_url,
              vote_count:    row.vote_count || 0,
              created_at:    row.created_at,
              author_name:   "You",
              author_avatar: null,
              voted_by_me:   false,
              is_mine:       true,
            },
            ...rest,
          ],
        };
      });
      setComposeOpen(false);
    } catch (err) {
      setPostError(err?.response?.data?.error || "Couldn't post writeup.");
    } finally {
      setPosting(false);
    }
  }, [posting, draft, slugOrId]);

  // ── Remove my writeup ────────────────────────────────────────
  const onRemoveMine = useCallback(async () => {
    if (!myWriteup) return;
    if (!confirm("Remove your writeup? You can always re-post.")) return;
    try {
      await problems.deleteWriteup(slugOrId, myWriteup.id);
      setData((d) => ({ ...d, writeups: d.writeups.filter((w) => !w.is_mine) }));
    } catch {
      alert("Couldn't remove. Try again.");
    }
  }, [myWriteup, slugOrId]);

  // ── Open composer pre-filled with my existing writeup ────────
  const openComposer = useCallback(() => {
    if (myWriteup) {
      setDraft({
        title:    myWriteup.title || "",
        body:     myWriteup.body  || "",
        repo_url: myWriteup.repo_url || "",
      });
    } else {
      setDraft({ title: "", body: "", repo_url: "" });
    }
    setPostError(null);
    setComposeOpen(true);
  }, [myWriteup]);

  // ── Render ───────────────────────────────────────────────────
  if (loading) {
    return (
      <section className="lamp-panel mt-12 flex justify-center p-8">
        <Loader variant="orbit" />
      </section>
    );
  }

  if (error || !data) {
    return (
      <p className="lamp-panel mt-12 p-5 text-center text-sm text-text-muted">
        {error || "No community data yet."}
      </p>
    );
  }

  return (
    <section className="mt-12 space-y-8">
      {/* ── Interest beacon strip ── */}
      <div data-reveal="scale" className="lamp-panel relative overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-text-primary">Working on this</h3>
            <p className="mt-1 text-sm leading-6 text-text-muted">
              {data.interest_count === 0 ? (
                <>Be the first to mark this — others will see you working on it.</>
              ) : data.interest_count === 1 ? (
                <>1 student is tackling this problem.</>
              ) : (
                <><AnimatedNumber value={data.interest_count} duration={0.6} /> students are tackling this problem.</>
              )}
            </p>
            {data.interested_users?.length > 0 && (
              <div className="mt-3 flex -space-x-2">
                {data.interested_users.map((u, i) => (
                  <motion.div
                    key={u.user_id}
                    initial={{ opacity: 0, x: -8, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.06, type: "spring", stiffness: 380, damping: 22 }}
                  >
                    <Avatar name={u.name} avatar_url={u.avatar_url} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <motion.button
            type="button"
            onClick={onToggleInterest}
            disabled={busy}
            whileTap={{ scale: 0.95 }}
            aria-pressed={Boolean(data.i_am_interested)}
            className={
              "relative inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors sm:w-auto " +
              (data.i_am_interested
                ? "bg-primary text-[rgb(var(--color-obsidian))] shadow-[0_10px_30px_-10px_rgb(var(--lamp)/0.9)]"
                : "border border-[rgb(var(--rule))] bg-surface/60 text-text-primary hover:border-primary/40")
            }
          >
            <motion.span
              key={data.i_am_interested ? "on" : "off"}
              initial={{ scale: 0.4, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 14 }}
              className="inline-flex"
            >
              {data.i_am_interested
                ? <Flame className="h-4 w-4" strokeWidth={2} />
                : <Plus className="h-4 w-4" strokeWidth={1.75} />}
            </motion.span>
            {data.i_am_interested ? "I'm on this" : "I'm tackling this"}
          </motion.button>
        </div>
      </div>

      {/* ── Writeups ── */}
      <div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-xl font-semibold text-text-primary">
            Writeups <span className="lamp-numerals ml-1 text-base text-text-dim">{data.writeups?.length || 0}</span>
          </h3>
          <button
            type="button"
            onClick={openComposer}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-3.5 text-sm font-medium text-text-primary transition hover:border-primary/40"
          >
            {myWriteup ? <PenLine className="h-4 w-4" strokeWidth={1.75} /> : <Plus className="h-4 w-4" strokeWidth={1.75} />}
            {myWriteup ? "Edit my writeup" : "Post a writeup"}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {composeOpen && (
            <motion.div
              key="composer"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <ComposerForm
                draft={draft}
                setDraft={setDraft}
                onSubmit={onSubmitWriteup}
                onCancel={() => setComposeOpen(false)}
                onRemoveMine={myWriteup ? onRemoveMine : null}
                posting={posting}
                postError={postError}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {data.writeups?.length === 0 ? (
          <p className="rounded-[1.25rem] border border-dashed border-[rgb(var(--rule))] p-6 text-center text-sm text-text-muted">
            No writeups yet. Be the first to post your approach.
          </p>
        ) : (
          <div data-stagger="up" className="space-y-4">
            {data.writeups.map((w) => (
              <WriteupCard key={w.id} w={w} onVote={() => onVote(w.id)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Avatar({ name, avatar_url }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[rgb(var(--color-surface))] bg-secondary/25 text-xs font-semibold text-text-primary"
      title={name}
    >
      {avatar_url ? (
        <img src={avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
      ) : initial}
    </div>
  );
}

function WriteupCard({ w, onVote }) {
  return (
    <article className={"lamp-panel p-4 sm:p-5 " + (w.is_mine ? "border-primary/30" : "")}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={w.author_name} avatar_url={w.author_avatar} />
          <span className="truncate text-sm font-medium text-text-primary">
            {w.is_mine ? "Your writeup" : w.author_name}
          </span>
          <span className="text-xs text-text-dim">
            {new Date(w.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Save writeup for later */}
          <BookmarkButton type="writeup" id={w.id} compact />
          <motion.button
            type="button"
            onClick={onVote}
            whileTap={{ scale: 0.9 }}
            className={
              "inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm tabular-nums transition-colors " +
              (w.voted_by_me
                ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                : "border border-[rgb(var(--rule))] text-text-muted hover:border-primary/40 hover:text-text-primary")
            }
            aria-label={w.voted_by_me ? "Remove upvote" : "Upvote"}
          >
            <motion.span
              key={w.voted_by_me ? "up" : "idle"}
              initial={w.voted_by_me ? { y: 6, opacity: 0 } : false}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 18 }}
              className="inline-flex"
            >
              <ArrowBigUp className="h-4 w-4" strokeWidth={1.75} fill={w.voted_by_me ? "currentColor" : "none"} />
            </motion.span>
            {w.vote_count}
          </motion.button>
        </div>
      </header>
      <h4 className="mt-3 text-[1.05rem] font-semibold text-text-primary">{w.title}</h4>
      <Prose text={w.body} />
      {w.repo_url && (
        <a
          href={w.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 break-all font-mono text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {w.repo_url.replace(/^https?:\/\//, "").slice(0, 60)}
        </a>
      )}
      <WriteupComments writeupId={w.id} initialCount={w.comment_count || 0} />
    </article>
  );
}

const FIELD = "w-full rounded-xl border border-[rgb(var(--rule))] bg-obsidian/50 px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-dim transition focus:border-primary/50 focus:outline-none";

function ComposerForm({ draft, setDraft, onSubmit, onCancel, onRemoveMine, posting, postError }) {
  return (
    <form onSubmit={onSubmit} className="lamp-panel lamp-panel--lit mb-5 p-4 sm:p-5">
      <input
        type="text"
        placeholder="Title — e.g. 'Solved with a sliding window in 40 lines'"
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        maxLength={200}
        className={FIELD + " min-h-[44px]"}
      />
      <textarea
        placeholder="Approach, gotchas, what you'd do differently. Markdown is rendered as plain paragraphs."
        value={draft.body}
        onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
        maxLength={16000}
        rows={7}
        className={FIELD + " mt-2.5 resize-y leading-6"}
      />
      <input
        type="url"
        placeholder="Repo URL (optional) — github.com/..."
        value={draft.repo_url}
        onChange={(e) => setDraft((d) => ({ ...d, repo_url: e.target.value }))}
        maxLength={500}
        className={FIELD + " mt-2.5 min-h-[44px] font-mono text-xs"}
      />
      {postError && (
        <p className="mt-2 text-sm text-danger">{postError}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {onRemoveMine && (
          <button
            type="button"
            onClick={onRemoveMine}
            className="mr-auto inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-danger transition hover:bg-danger/10"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            Remove
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[40px] rounded-xl px-3.5 text-sm font-medium text-text-muted transition hover:bg-white/[0.04] hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={posting}
          className="min-h-[40px] rounded-xl bg-primary px-4 text-sm font-semibold text-[rgb(var(--color-obsidian))] transition hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
        >
          {posting ? "Posting…" : (onRemoveMine ? "Save changes" : "Post writeup")}
        </button>
      </div>
    </form>
  );
}

function Prose({ text }) {
  if (!text) return null;
  const paragraphs = String(text).split(/\n\n+/).filter(Boolean);
  return (
    <div className="mt-2 max-w-[68ch] space-y-2.5 break-words text-[15px] leading-7 text-text-primary/85">
      {paragraphs.map((para, i) => (
        <p key={i} className="whitespace-pre-wrap">{para}</p>
      ))}
    </div>
  );
}
