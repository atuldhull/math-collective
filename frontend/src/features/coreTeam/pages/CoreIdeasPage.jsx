import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowBigUp, Check, Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { core } from "@/lib/api";
import { useCoreStore } from "@/store/core-store";
import { ModalShell, Field, INPUT_CLS } from "@/features/coreTeam/components/FormBits";
import { AsymptoteCurve, EmptyState, PageHeader, SegmentedTabs } from "@/components/lamp";

const FIELDS = ["Marketing", "Social Media", "Design", "Events", "Technical", "Maths", "General"];

export default function CoreIdeasPage() {
  const { member } = useCoreStore();
  const [ideas, setIdeas] = useState(null);
  const [threshold, setThreshold] = useState(17);
  const [filter, setFilter] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [voting, setVoting] = useState(null);

  const load = useCallback(() => {
    core.ideas()
      .then((r) => { setIdeas(r.data?.ideas || []); setThreshold(r.data?.threshold || 17); })
      .catch(() => setIdeas([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const vote = async (idea) => {
    setVoting(idea.id);
    try {
      const { data } = await core.voteIdea(idea.id);
      setIdeas((prev) => prev.map((i) =>
        i.id === idea.id
          ? { ...i, vote_count: data.voteCount, hasVoted: data.hasVoted, status: data.approved ? "approved" : i.status }
          : i,
      ));
    } catch { /* ignore */ }
    setVoting(null);
  };

  const remove = async (id) => {
    try { await core.deleteIdea(id); setIdeas((p) => p.filter((i) => i.id !== id)); } catch { /* ignore */ }
  };

  if (!ideas) {
    return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" label="Loading ideas…" /></div>;
  }

  const fields = ["All", ...new Set(ideas.map((i) => i.field))];
  const visible = filter === "All" ? ideas : ideas.filter((i) => i.field === filter);

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Core team"
        title="Ideas"
        description={`Pitch something for the club. At ${threshold} votes an idea is green-lit.`}
        actions={(
          <Button size="sm" variant="primary" magnetic={false} onClick={() => setShowNew(true)} leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
            Share an idea
          </Button>
        )}
      >
        <SegmentedTabs
          aria-label="Filter ideas by field"
          value={filter}
          onChange={setFilter}
          items={fields.map((f) => ({ value: f, label: f, count: f === "All" ? ideas.length : ideas.filter((i) => i.field === f).length }))}
        />
      </PageHeader>

      {visible.length === 0 && (
        <EmptyState
          title="No ideas here yet"
          body="Be the first to pitch one."
          action={<Button size="sm" variant="secondary" magnetic={false} onClick={() => setShowNew(true)}>Share an idea</Button>}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {visible.map((idea) => {
            const pct = Math.min(100, Math.round((idea.vote_count / threshold) * 100));
            const approved = idea.status === "approved";
            const canDelete = member?.tier === "council" || idea.author_member_id === member?.id;
            return (
              <motion.article
                key={idea.id}
                layout
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className={`lamp-panel flex h-full flex-col p-5 ${approved ? "lamp-panel--lit" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-0.5 text-[11px] font-medium text-secondary">
                    {idea.field}
                  </span>
                  {approved && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-[11px] font-medium text-success">
                      <Check className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />Approved
                    </span>
                  )}
                </div>
                <h3 className="mt-3 break-words text-lg text-text-primary">{idea.title}</h3>
                <p className="mt-1 flex-1 break-words text-sm leading-6 text-text-muted">{idea.body}</p>

                <p className="mt-3 text-[12px] text-text-dim">by {idea.author_name || "A core member"}</p>

                {/* vote progress — the dot rides the asymptote toward the green-light line */}
                <div className="mt-2 flex items-end gap-3">
                  <AsymptoteCurve progress={pct / 100} tone={approved ? "lamp" : "violet"} className="h-10 w-28 shrink-0" />
                  <p className="pb-0.5 text-[12px] text-text-dim">
                    <span className="lamp-numerals text-text-muted">{idea.vote_count}</span> / <span className="lamp-numerals">{threshold}</span> votes to green-light
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-[rgb(var(--rule))] pt-3">
                  <Button
                    size="sm"
                    variant={idea.hasVoted ? "secondary" : "primary"}
                    magnetic={false}
                    loading={voting === idea.id}
                    onClick={() => vote(idea)}
                    aria-pressed={!!idea.hasVoted}
                    leading={<ArrowBigUp className={`h-4 w-4 ${idea.hasVoted ? "fill-current" : ""}`} strokeWidth={1.75} />}
                  >
                    {idea.hasVoted ? "Voted" : "Vote"}
                    <motion.span
                      key={idea.vote_count}
                      initial={{ y: -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="lamp-numerals ml-1.5 inline-block"
                    >
                      {idea.vote_count}
                    </motion.span>
                  </Button>
                  {canDelete && (
                    <button onClick={() => remove(idea.id)} aria-label={`Delete ${idea.title}`}
                      className="ml-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-[13px] text-text-dim transition hover:bg-danger/10 hover:text-danger">
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                      Delete
                    </button>
                  )}
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showNew && <NewIdeaModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />}
      </AnimatePresence>
    </div>
  );
}

function NewIdeaModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ field: "General", title: "", body: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    if (form.title.trim().length < 3) { setErr("Give your idea a title."); return; }
    if (form.body.trim().length < 10) { setErr("Describe the idea a little more."); return; }
    setBusy(true); setErr(null);
    try {
      await core.createIdea({ field: form.field, title: form.title.trim(), body: form.body.trim() });
      onCreated();
    } catch (e) {
      setErr(e?.response?.data?.error || "Could not post idea.");
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Share an idea" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Field">
          <select value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} className={INPUT_CLS}>
            {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Title">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={INPUT_CLS} placeholder="One line — what's the idea?" />
        </Field>
        <Field label="Describe it">
          <textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
            className={INPUT_CLS} placeholder="How would it work? Why is it good?" />
        </Field>
        {err && <p role="alert" className="text-[13px] text-danger">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" magnetic={false} onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" magnetic={false} loading={busy} onClick={save}>Post idea</Button>
        </div>
      </div>
    </ModalShell>
  );
}
