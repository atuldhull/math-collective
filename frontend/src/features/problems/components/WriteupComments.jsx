/**
 * WriteupComments — flat comment thread under a writeup card.
 *
 * Collapsed by default; expands on click and fetches the comment
 * list (lazy load — most writeups won't have any comments yet, no
 * reason to spam the backend with empty lists at panel mount).
 *
 * The composer is auto-hidden until the user clicks "Add comment"
 * so the collapsed-but-expanded state still reads like a list, not
 * a form. Soft-deleted comments render a "[comment removed]"
 * placeholder so the count remains honest.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageCircle, Plus } from "lucide-react";
import { writeupComments as commentsApi } from "@/lib/api";

const MAX_BODY = 2000;

export default function WriteupComments({ writeupId, initialCount = 0 }) {
  const [open,       setOpen]       = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [comments,   setComments]   = useState([]);
  const [count,      setCount]      = useState(initialCount);
  const [composeOn,  setComposeOn]  = useState(false);
  const [draft,      setDraft]      = useState("");
  const [posting,    setPosting]    = useState(false);
  const ctrlRef = useRef(null);

  // ── Lazy fetch on first expand. Cancels in-flight on collapse. ─
  useEffect(() => {
    if (!open || loaded || loading) return;
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    setError(null);
    commentsApi
      .list(writeupId, { signal: ctrl.signal })
      .then(({ data }) => {
        setComments(data.data || []);
        setCount(data.total ?? (data.data || []).length);
        setLoaded(true);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        setError(err?.response?.data?.error || "Couldn't load comments");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [open, loaded, loading, writeupId]);

  // ── Submit a new comment. Optimistic-ish: we wait for the server
  // response (which includes the resolved author name) and splice it
  // in — server-issued payload is the truth.
  const onPost = useCallback(
    async (e) => {
      e?.preventDefault();
      if (posting) return;
      const body = draft.trim();
      if (!body) return;
      if (body.length > MAX_BODY) {
        setError(`Comment capped at ${MAX_BODY} characters`);
        return;
      }
      setPosting(true);
      setError(null);
      try {
        const { data: row } = await commentsApi.post(writeupId, body);
        setComments((cs) => [...cs, row]);
        setCount((c) => c + 1);
        setDraft("");
        setComposeOn(false);
      } catch (err) {
        setError(err?.response?.data?.error || "Couldn't post comment");
      } finally {
        setPosting(false);
      }
    },
    [posting, draft, writeupId],
  );

  // ── Soft-delete handler — author / writeup-owner / mod can call. ─
  const onDelete = useCallback(
    async (commentId) => {
      if (!confirm("Remove this comment? It can't be restored.")) return;
      try {
        await commentsApi.remove(commentId);
        setComments((cs) =>
          cs.map((c) => (c.id === commentId ? { ...c, body: null, is_deleted: true, can_edit: false, can_delete: false } : c)),
        );
      } catch (err) {
        alert(err?.response?.data?.error || "Couldn't remove comment");
      }
    },
    [],
  );

  // ── Inline edit ─────────────────────────────────────────────────
  const onEdit = useCallback(async (commentId, newBody) => {
    try {
      const { data } = await commentsApi.edit(commentId, newBody);
      setComments((cs) =>
        cs.map((c) => (c.id === commentId ? { ...c, body: data.body, edited: data.edited ?? true, updated_at: data.updated_at } : c)),
      );
      return true;
    } catch (err) {
      alert(err?.response?.data?.error || "Couldn't save edit");
      return false;
    }
  }, []);

  return (
    <div className="mt-4 border-t border-[rgb(var(--rule))] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="-my-1 inline-flex min-h-[40px] items-center gap-2 py-2 text-[13px] font-medium text-text-muted transition hover:text-text-primary"
        aria-expanded={open}
      >
        <MessageCircle className="h-4 w-4" strokeWidth={1.75} />
        <span>Comments <span className="tabular-nums text-text-dim">{count}</span></span>
        <ChevronDown className={"h-3.5 w-3.5 transition-transform duration-300 " + (open ? "rotate-180" : "")} strokeWidth={1.75} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              {loading && <p className="text-xs text-text-dim">Loading…</p>}
              {error && <p className="text-xs text-danger">{error}</p>}
              {!loading && !error && comments.length === 0 && (
                <p className="text-xs text-text-dim">No comments yet. Be the first to chime in.</p>
              )}
              <AnimatePresence initial={false}>
                {comments.map((c, i) => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
                  >
                    <CommentRow c={c} onDelete={() => onDelete(c.id)} onEdit={onEdit} />
                  </motion.div>
                ))}
              </AnimatePresence>

              {composeOn ? (
                <form onSubmit={onPost} className="rounded-xl border border-primary/25 bg-primary/[0.05] p-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    maxLength={MAX_BODY}
                    autoFocus
                    placeholder="Share your thought, a follow-up question, or a gotcha you spotted…"
                    className="w-full resize-y rounded-xl border border-[rgb(var(--rule))] bg-obsidian/50 px-3 py-2 text-sm leading-6 text-text-primary placeholder:text-text-dim focus:border-primary/50 focus:outline-none"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                    <span className="mr-auto text-xs tabular-nums text-text-dim">
                      {draft.length}/{MAX_BODY}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setComposeOn(false); setDraft(""); setError(null); }}
                      className="inline-flex min-h-[36px] items-center rounded-xl px-3 text-[13px] font-medium text-text-muted transition hover:bg-white/[0.04] hover:text-text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={posting || !draft.trim()}
                      className="inline-flex min-h-[36px] items-center rounded-xl bg-primary px-3.5 text-[13px] font-semibold text-[rgb(var(--color-obsidian))] transition hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                    >
                      {posting ? "Posting…" : "Post comment"}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setComposeOn(true)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[rgb(var(--rule))] px-3 text-[13px] font-medium text-text-muted transition hover:border-primary/30 hover:text-text-primary"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Add comment
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function CommentRow({ c, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(c.body || "");
  const [saving,  setSaving]  = useState(false);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (saving) return;
    const next = draft.trim();
    if (!next || next === c.body) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const ok = await onEdit(c.id, next);
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (c.is_deleted) {
    return (
      <div className="rounded-xl border border-dashed border-[rgb(var(--rule))] px-3 py-2 text-xs italic text-text-dim">
        [comment removed]
      </div>
    );
  }

  return (
    <div className="rounded-xl border-l-2 border-secondary/40 bg-white/[0.025] py-2.5 pl-3.5 pr-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={c.author_name} avatar_url={c.author_avatar} />
          <span className="truncate text-[13px] font-medium text-text-primary">
            {c.is_mine ? "You" : c.author_name}
          </span>
          <span className="text-xs text-text-dim">
            {new Date(c.created_at).toLocaleDateString()}
          </span>
          {c.edited && <span className="text-xs text-text-dim">(edited)</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {c.can_edit && !editing && (
            <button
              type="button"
              onClick={() => { setDraft(c.body || ""); setEditing(true); }}
              className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-text-muted transition hover:bg-white/[0.05] hover:text-text-primary"
            >
              Edit
            </button>
          )}
          {c.can_delete && !editing && (
            <button
              type="button"
              onClick={onDelete}
              className="min-h-[32px] rounded-lg px-2 text-xs font-medium text-danger transition hover:bg-danger/10"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={MAX_BODY}
            autoFocus
            className="w-full resize-y rounded-xl border border-[rgb(var(--rule))] bg-obsidian/50 px-3 py-2 text-sm leading-6 text-text-primary placeholder:text-text-dim focus:border-primary/50 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex min-h-[36px] items-center rounded-xl px-3 text-[13px] font-medium text-text-muted transition hover:bg-white/[0.04] hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-[36px] items-center rounded-xl bg-primary px-3.5 text-[13px] font-semibold text-[rgb(var(--color-obsidian))] transition hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-1.5 max-w-[68ch] whitespace-pre-wrap break-words text-sm leading-6 text-text-primary/85">{c.body}</p>
      )}
    </div>
  );
}

function Avatar({ name, avatar_url }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/25 text-[11px] font-semibold text-text-primary"
      title={name}
    >
      {avatar_url ? <img src={avatar_url} alt="" className="h-full w-full rounded-full object-cover" /> : initial}
    </div>
  );
}
