import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EyeOff, Flag, Send } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { core } from "@/lib/api";
import { useCoreStore } from "@/store/core-store";
import { useAuthStore } from "@/store/auth-store";
import { Field, INPUT_CLS } from "@/features/coreTeam/components/FormBits";
import { EmptyState, PageHeader, SegmentedTabs } from "@/components/lamp";

const STATUS_CLS = {
  open:     "border-warning/40 bg-warning/10 text-warning",
  reviewed: "border-secondary/40 bg-secondary/10 text-secondary",
  resolved: "border-success/40 bg-success/10 text-success",
};

export default function CoreFeedbackPage() {
  const { member } = useCoreStore();
  const siteRole = useAuthStore((s) => s.user?.role);
  const isLead = member?.tier === "council" || member?.tier === "head";
  const canReveal = siteRole === "admin" || siteRole === "super_admin";

  const [teams, setTeams] = useState([]);
  const [list, setList] = useState(isLead ? null : []);
  const [form, setForm] = useState({ scope: "club", teamId: "", kind: "suggestion", body: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);
  const [revealed, setRevealed] = useState({});

  const loadList = useCallback(() => {
    if (!isLead) return;
    core.feedback().then((r) => setList(r.data || [])).catch(() => setList([]));
  }, [isLead]);

  useEffect(() => {
    core.teams().then((r) => setTeams(r.data?.teams || [])).catch(() => {});
    loadList();
  }, [loadList]);

  const submit = async () => {
    if (form.body.trim().length < 5) { setErr("Add a little more detail."); return; }
    if (form.scope === "team" && !form.teamId) { setErr("Pick which team this is about."); return; }
    setBusy(true); setErr(null);
    try {
      await core.createFeedback({
        scope: form.scope,
        teamId: form.scope === "team" ? form.teamId : undefined,
        kind: form.kind,
        body: form.body.trim(),
      });
      setSent(true);
      setForm({ scope: "club", teamId: "", kind: "suggestion", body: "" });
      loadList();
      setTimeout(() => setSent(false), 6000);
    } catch (e) {
      setErr(e?.response?.data?.error || "Could not submit — try again.");
    }
    setBusy(false);
  };

  const setStatus = async (id, status) => {
    try {
      await core.setFeedbackStatus(id, status);
      loadList();
    } catch { /* surfaced on reload */ }
  };

  const reveal = async (id) => {
    try {
      const { data } = await core.revealAuthor(id);
      setRevealed((r) => ({ ...r, [id]: data }));
    } catch (e) {
      setRevealed((r) => ({ ...r, [id]: { error: e?.response?.data?.error || "Not permitted." } }));
    }
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Core team"
        title="Feedback"
        description="Say what is working and what is not. Nobody sees your name unless the message is abusive."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
        {/* Submit form */}
        <section data-reveal="tilt" className="lamp-panel lamp-panel--lit overflow-hidden p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="flex items-center gap-2 text-xl text-text-primary">
            <EyeOff className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
            Anonymous feedback
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Suggestions and complaints are <span className="text-text-primary">anonymous</span>. Club-wide goes to the
            council; team-specific also reaches that team&apos;s head. Identity is only ever revealed if the
            content is abusive.
          </p>

          <AnimatePresence mode="wait" initial={false}>
            {sent ? (
              <motion.div
                key="sent"
                role="status"
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-8 text-center text-sm text-success"
              >
                <svg viewBox="0 0 48 48" className="h-12 w-12" fill="none" aria-hidden="true">
                  <motion.circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: "easeOut" }} />
                  <motion.path d="M15 24.5 L21.5 31 L33.5 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.45, ease: "easeOut" }} />
                </svg>
                Sent anonymously. Thank you.
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                // The note folds up and away like a slip posted through a slot.
                exit={{ opacity: 0, y: -40, rotateX: 50, scale: 0.9, transition: { duration: 0.45, ease: [0.7, 0, 0.84, 0] } }}
                style={{ transformPerspective: 900, transformOrigin: "50% 0%" }}
                className="mt-5 space-y-4"
              >
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-text-muted">About</p>
                  <SegmentedTabs
                    size="sm"
                    aria-label="Feedback is about"
                    value={form.scope}
                    onChange={(v) => setForm({ ...form, scope: v })}
                    items={[{ value: "club", label: "The whole club" }, { value: "team", label: "A specific team" }]}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-[13px] font-medium text-text-muted">Type</p>
                  <SegmentedTabs
                    size="sm"
                    aria-label="Feedback type"
                    value={form.kind}
                    onChange={(v) => setForm({ ...form, kind: v })}
                    items={[{ value: "suggestion", label: "Suggestion" }, { value: "complaint", label: "Complaint" }]}
                  />
                </div>
                <AnimatePresence initial={false}>
                  {form.scope === "team" && (
                    <motion.div key="team" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <Field label="Which team">
                        <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })} className={INPUT_CLS}>
                          <option value="">— pick a team —</option>
                          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </Field>
                    </motion.div>
                  )}
                </AnimatePresence>
                <Field label="Your message">
                  <textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                    className={INPUT_CLS} placeholder="Say what's on your mind…" />
                </Field>
                {err && <p role="alert" className="text-[13px] text-danger">{err}</p>}
                <div className="flex justify-end">
                  <Button size="sm" variant="primary" magnetic={false} loading={busy} onClick={submit} leading={<Send className="h-4 w-4" strokeWidth={1.75} />}>
                    Send anonymously
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Inbox — leads only */}
        {isLead && (
          <section>
            <h2 className="mb-3 text-lg text-text-primary">
              {member?.tier === "council" ? "All feedback" : "Feedback for your team"}
              {Array.isArray(list) && <span className="lamp-numerals ml-2 text-text-dim">{list.length}</span>}
            </h2>
            {list === null ? (
              <div className="flex justify-center py-12"><Loader variant="orbit" size="md" /></div>
            ) : list.length === 0 ? (
              <EmptyState compact title="No feedback yet" body="When members send something, it will appear here for you to review." />
            ) : (
              <div data-stagger="up" className="grid gap-3">
                {list.map((f) => (
                  <article key={f.id} className={`lamp-panel p-4 sm:p-5 ${f.is_flagged ? "border-danger/40" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                        f.kind === "complaint" ? "border-danger/40 bg-danger/10 text-danger" : "border-primary/40 bg-primary/10 text-primary"
                      }`}>
                        {f.kind}
                      </span>
                      <span className="text-[12px] text-text-dim">
                        {f.scope === "team" ? (f.core_teams?.name || "Team") : "Club-wide"}
                      </span>
                      {f.is_flagged && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-0.5 text-[11px] font-medium text-danger">
                          <Flag className="h-3 w-3" strokeWidth={2} aria-hidden="true" />Flagged
                        </span>
                      )}
                      <span className="lamp-numerals ml-auto text-[12px] text-text-dim">
                        {new Date(f.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-3 break-words text-sm leading-7 text-text-primary">{f.body}</p>
                    {f.flag_reason && <p className="mt-2 text-[13px] text-danger">{f.flag_reason}</p>}

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--rule))] pt-3">
                      <select
                        aria-label="Feedback status"
                        value={f.status}
                        onChange={(e) => setStatus(f.id, e.target.value)}
                        className={`min-h-[36px] rounded-full border px-3 py-1 text-[12px] font-medium outline-none ${STATUS_CLS[f.status]}`}
                      >
                        <option value="open">Open</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="resolved">Resolved</option>
                      </select>
                      {f.is_flagged && canReveal && !revealed[f.id] && (
                        <button onClick={() => reveal(f.id)}
                          className="min-h-[36px] rounded-lg px-2 text-[13px] text-danger hover:bg-danger/10">
                          Reveal author
                        </button>
                      )}
                      <AnimatePresence>
                        {revealed[f.id] && (
                          <motion.span key="rev" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="text-[13px] text-text-muted">
                            {revealed[f.id].error
                              ? revealed[f.id].error
                              : `Author: ${revealed[f.id].author_name || "Unknown"}`}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {!isLead && (
          <section data-reveal="up" className="lamp-panel p-6 text-center">
            <p className="text-sm leading-6 text-text-muted">
              Your submissions go straight to the council and team heads — you won&apos;t see them listed here.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
