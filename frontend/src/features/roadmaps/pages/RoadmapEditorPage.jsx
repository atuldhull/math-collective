/**
 * RoadmapEditorPage — /roadmaps/:slug/edit
 *
 * The author's space. Top half is a meta form (title, summary,
 * description, difficulty, topic, hours, cover emoji). Bottom half
 * is the step list with add / edit / remove / reorder.
 *
 * Submission states surfaced clearly:
 *   draft     — fully editable, "Submit for review" button live
 *   pending   — read-mostly + "Withdraw" button
 *   approved  — visible to everyone; edits locked unless admin
 *   rejected  — editable + reject_reason callout + "Re-submit"
 *
 * On the wire: meta saves are debounced (don't blast on every
 * keystroke). Step add/edit/delete are immediate. Reorder uses two
 * arrow buttons per row — not a drag-handle because dnd-kit isn't
 * already a dep and the steps list is short (~6-15 entries).
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowUp, Check, ExternalLink, PenLine, Plus, Save, Send, Trash2, Undo2, X } from "lucide-react";
import { roadmaps as roadmapsApi } from "@/lib/api";
import Loader from "@/components/ui/Loader";
import { PageHeader, EmptyState } from "@/components/lamp";

const STATUS_CLASS = {
  draft:    { border: "",                  text: "text-text-muted", label: "Draft" },
  pending:  { border: "border-warning/40", text: "text-warning",    label: "Pending review" },
  approved: { border: "border-success/40", text: "text-success",    label: "Approved" },
  rejected: { border: "border-danger/40",  text: "text-danger",     label: "Rejected" },
};

// The road a roadmap travels; "rejected" sits at the review stage.
const STAGES = ["draft", "pending", "approved"];
const STAGE_LABEL = { draft: "Draft", pending: "Review", approved: "Published" };

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

export default function RoadmapEditorPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [roadmap,  setRoadmap]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // Form state — kept local; we PATCH on Save click rather than
  // on every keystroke to avoid pinging the API mid-typing.
  const [form, setForm] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // Working set of steps for reorder ergonomics (the rendered order
  // matches `roadmap.steps` after each mutation).
  const steps = roadmap?.steps || [];

  // Load.
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    roadmapsApi.get(slug, { signal: ctrl.signal })
      .then(({ data }) => {
        setRoadmap(data);
        setForm({
          title:       data.title || "",
          summary:     data.summary || "",
          description: data.description || "",
          difficulty:  data.difficulty || "intermediate",
          topic:       data.topic || "",
          est_hours:   data.est_hours ?? "",
          cover_emoji: data.cover_emoji || "",
        });
        setLoading(false);
      })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        setError(err?.response?.status === 404 ? "not-found" : (err?.response?.data?.error || "Couldn't load roadmap"));
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [slug]);

  const readOnly = useMemo(() => {
    if (!roadmap) return true;
    if (roadmap.is_owner) return roadmap.submission_status === "pending" || roadmap.submission_status === "approved";
    return true;        // moderators can edit too but we don't expose that UI here
  }, [roadmap]);

  // ── Save meta ──
  const onSaveMeta = useCallback(async () => {
    if (!roadmap || !form || saving) return;
    setSaving(true); setSaveMsg(null);
    try {
      const patch = {
        title:       form.title,
        summary:     form.summary,
        description: form.description,
        difficulty:  form.difficulty,
        topic:       form.topic,
        ...(form.est_hours === "" ? {} : { est_hours: Number(form.est_hours) }),
        cover_emoji: form.cover_emoji,
      };
      const { data } = await roadmapsApi.update(roadmap.id, patch);
      setRoadmap((r) => ({ ...r, ...data }));
      setSaveMsg("Saved ✓");
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (err) {
      setSaveMsg(err?.response?.data?.error || "Couldn't save");
    } finally {
      setSaving(false);
    }
  }, [roadmap, form, saving]);

  // ── Step mutations ──
  const onAddStep = useCallback(async () => {
    if (!roadmap) return;
    const title = prompt("Step title?");
    if (!title || !title.trim()) return;
    try {
      const { data: step } = await roadmapsApi.addStep(roadmap.id, { title: title.trim() });
      setRoadmap((r) => ({ ...r, steps: [...(r.steps || []), { ...step, done: false }] }));
    } catch (err) {
      alert(err?.response?.data?.error || "Couldn't add step");
    }
  }, [roadmap]);

  const onUpdateStep = useCallback(async (stepId, patch) => {
    try {
      const { data: step } = await roadmapsApi.updateStep(stepId, patch);
      setRoadmap((r) => ({
        ...r,
        steps: r.steps.map((s) => s.id === stepId ? { ...s, ...step } : s),
      }));
    } catch (err) {
      alert(err?.response?.data?.error || "Couldn't save step");
    }
  }, []);

  const onDeleteStep = useCallback(async (stepId) => {
    if (!confirm("Delete this step?")) return;
    try {
      await roadmapsApi.removeStep(stepId);
      setRoadmap((r) => ({ ...r, steps: r.steps.filter((s) => s.id !== stepId) }));
    } catch (err) {
      alert(err?.response?.data?.error || "Couldn't delete step");
    }
  }, []);

  const onMove = useCallback(async (stepId, direction) => {
    if (!roadmap) return;
    const order = [...steps.map((s) => s.id)];
    const idx = order.indexOf(stepId);
    if (idx === -1) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= order.length) return;
    [order[idx], order[swap]] = [order[swap], order[idx]];
    // Optimistic reorder + revert on failure.
    setRoadmap((r) => ({
      ...r,
      steps: order.map((id) => r.steps.find((s) => s.id === id)),
    }));
    try {
      await roadmapsApi.reorderSteps(roadmap.id, order);
    } catch {
      // Refetch to recover canonical order.
      const { data } = await roadmapsApi.get(slug);
      setRoadmap(data);
    }
  }, [roadmap, steps, slug]);

  // ── Submission lifecycle ──
  const onSubmit = useCallback(async () => {
    if (!roadmap) return;
    try {
      await roadmapsApi.submit(roadmap.id);
      const { data } = await roadmapsApi.get(slug);
      setRoadmap(data);
    } catch (err) {
      alert(err?.response?.data?.error || "Couldn't submit");
    }
  }, [roadmap, slug]);

  const onWithdraw = useCallback(async () => {
    if (!roadmap) return;
    try {
      await roadmapsApi.withdraw(roadmap.id);
      const { data } = await roadmapsApi.get(slug);
      setRoadmap(data);
    } catch (err) {
      alert(err?.response?.data?.error || "Couldn't withdraw");
    }
  }, [roadmap, slug]);

  const onDeleteRoadmap = useCallback(async () => {
    if (!roadmap) return;
    if (!confirm("Delete this entire roadmap? This cannot be undone.")) return;
    try {
      await roadmapsApi.remove(roadmap.id);
      navigate("/roadmaps");
    } catch (err) {
      alert(err?.response?.data?.error || "Couldn't delete");
    }
  }, [roadmap, navigate]);

  // ── Render ──
  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader variant="orbit" /></div>;
  }

  if (error === "not-found") {
    return (
      <div className="mx-auto w-full max-w-2xl py-12">
        <EmptyState
          title="Roadmap not found."
          body="It may have been deleted. Start from the list of roadmaps."
          action={
            <Link to="/roadmaps" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-medium text-primary transition hover:bg-primary/15">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              All roadmaps
            </Link>
          }
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl py-12">
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-sm text-danger">{error}</div>
      </div>
    );
  }

  if (!roadmap?.is_owner && !["admin", "teacher", "super_admin"].includes(roadmap?.viewer_role)) {
    // Backend doesn't ship viewer_role; we just gate on is_owner.
    // Moderators landing here will see a read-only view.
  }

  const status = STATUS_CLASS[roadmap.submission_status] || STATUS_CLASS.draft;
  const stageIndex = STAGES.indexOf(roadmap.submission_status === "rejected" ? "pending" : roadmap.submission_status);

  return (
    <div className="mx-auto w-full max-w-4xl pb-24">
      <Link
        to={`/roadmaps/${encodeURIComponent(roadmap.slug)}`}
        className="mb-5 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-text-muted transition hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Back to roadmap
      </Link>

      <PageHeader
        context="Roadmap editor"
        title={roadmap.title || "Untitled roadmap"}
        size="sm"
        curve={false}
      >
        {/* Status: where this roadmap sits on draft → review → published */}
        <div className={"lamp-panel p-4 sm:p-5 " + status.border}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={"inline-flex items-center gap-2 text-sm font-semibold " + status.text}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-40 motion-reduce:hidden" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-current" />
              </span>
              {status.label}
            </p>
            <ol className="flex items-center gap-1.5" aria-label="Review stages">
              {STAGES.map((s, i) => (
                <li key={s} className="flex items-center gap-1.5">
                  <span className={"relative rounded-lg px-2 py-1 text-xs font-medium " + (i <= stageIndex ? "text-text-primary" : "text-text-dim")}>
                    {i === stageIndex && (
                      <motion.span layoutId="roadmap-stage" className="absolute inset-0 rounded-lg bg-white/[0.07] ring-1 ring-[rgb(var(--rule))]" />
                    )}
                    <span className="relative">{STAGE_LABEL[s]}</span>
                  </span>
                  {i < STAGES.length - 1 && <span aria-hidden="true" className={"h-px w-4 " + (i < stageIndex ? "bg-primary" : "bg-[rgb(var(--rule))]")} />}
                </li>
              ))}
            </ol>
          </div>
          {roadmap.submission_status === "rejected" && roadmap.reject_reason && (
            <p className="mt-3 text-sm text-danger">Reason: {roadmap.reject_reason}</p>
          )}
          {roadmap.submission_status === "pending" && (
            <p className="mt-3 text-sm text-text-muted">An admin will review this shortly. You can withdraw to keep editing.</p>
          )}
        </div>
      </PageHeader>

      {/* Meta form */}
      <section data-reveal="up" className="lamp-panel lamp-panel--lit p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-text-primary">Details</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-[88px_1fr]">
          <Field label="Emoji" inline>
            <input
              type="text" value={form.cover_emoji}
              onChange={(e) => setForm((f) => ({ ...f, cover_emoji: e.target.value }))}
              maxLength={4} disabled={readOnly}
              className={INPUT + " text-center text-2xl"}
            />
          </Field>
          <Field label="Title" inline>
            <input
              type="text" value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={120} disabled={readOnly}
              className={INPUT}
            />
          </Field>
        </div>

        <Field label="Summary" hint="One-line elevator pitch, max 240 chars">
          <input
            type="text" value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            maxLength={240} disabled={readOnly}
            className={INPUT}
          />
        </Field>

        <Field label="Description" hint="Longer intro (optional)">
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4} maxLength={4000} disabled={readOnly}
            className={INPUT + " resize-y leading-6"}
          />
        </Field>

        <div className="grid gap-x-3 sm:grid-cols-3">
          <Field label="Difficulty">
            <select
              value={form.difficulty}
              onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
              disabled={readOnly}
              className={INPUT + " capitalize"}
            >
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Topic">
            <input
              type="text" value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              maxLength={60} disabled={readOnly}
              className={INPUT}
            />
          </Field>
          <Field label="Est. hours">
            <input
              type="number" min={0} max={1000} value={form.est_hours}
              onChange={(e) => setForm((f) => ({ ...f, est_hours: e.target.value }))}
              disabled={readOnly}
              className={INPUT + " tabular-nums"}
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <AnimatePresence>
            {saveMsg && (
              <motion.p
                key={saveMsg}
                initial={{ opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                className={"mr-auto inline-flex items-center gap-1.5 text-sm font-medium " + (saveMsg.includes("✓") ? "text-success" : "text-danger")}
              >
                {saveMsg.includes("✓") && <Check className="h-4 w-4" strokeWidth={2.25} />}
                {saveMsg.replace(" ✓", "")}
              </motion.p>
            )}
          </AnimatePresence>
          <motion.button
            type="button"
            onClick={onSaveMeta}
            disabled={readOnly || saving}
            whileTap={{ scale: 0.96 }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-[rgb(var(--color-obsidian))] transition hover:brightness-110 disabled:opacity-50"
          >
            <Save className="h-4 w-4" strokeWidth={1.75} />
            {saving ? "Saving…" : "Save details"}
          </motion.button>
        </div>
      </section>

      {/* Steps */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xl font-semibold text-text-primary">
            Steps <span className="lamp-numerals ml-1 text-base text-text-dim">{steps.length}</span>
          </h2>
          <button
            type="button"
            onClick={onAddStep}
            disabled={readOnly}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 text-sm font-medium text-primary transition hover:bg-primary/15 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add step
          </button>
        </div>

        <ol className="relative space-y-3">
          <AnimatePresence initial={false}>
            {steps.map((step, i) => (
              <StepEditor
                key={step.id}
                step={step}
                index={i}
                isFirst={i === 0}
                isLast={i === steps.length - 1}
                readOnly={readOnly}
                onUpdate={(patch) => onUpdateStep(step.id, patch)}
                onDelete={() => onDeleteStep(step.id)}
                onMoveUp={() => onMove(step.id, "up")}
                onMoveDown={() => onMove(step.id, "down")}
              />
            ))}
          </AnimatePresence>
        </ol>

        {steps.length === 0 && (
          <p className="rounded-[1.25rem] border border-dashed border-[rgb(var(--rule))] p-6 text-center text-sm text-text-muted">
            No steps yet. Add the first one above.
          </p>
        )}
      </section>

      {/* Submission controls */}
      {roadmap.is_owner && (
        <section data-reveal="up" className="lamp-panel mt-10 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-text-primary">Submission</h2>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            {(roadmap.submission_status === "draft" || roadmap.submission_status === "rejected") && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={steps.length < 3}
                title={steps.length < 3 ? "Need at least 3 steps" : "Send to moderation"}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-[rgb(var(--color-obsidian))] transition hover:brightness-110 disabled:opacity-50"
              >
                <Send className="h-4 w-4" strokeWidth={1.75} />
                {roadmap.submission_status === "rejected" ? "Re-submit for review" : "Submit for review"}
              </button>
            )}
            {roadmap.submission_status === "pending" && (
              <button
                type="button"
                onClick={onWithdraw}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[rgb(var(--rule))] px-4 text-sm font-medium text-text-primary transition hover:border-warning/40 hover:text-warning"
              >
                <Undo2 className="h-4 w-4" strokeWidth={1.75} />
                Withdraw
              </button>
            )}
            <button
              type="button"
              onClick={onDeleteRoadmap}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-medium text-danger transition hover:bg-danger/10 sm:ml-auto"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              Delete roadmap
            </button>
          </div>
          {steps.length < 3 && (roadmap.submission_status === "draft" || roadmap.submission_status === "rejected") && (
            <div className="mt-3">
              <p className="text-xs text-text-dim">Roadmaps need at least 3 steps before submission.</p>
              <div className="mt-2 flex gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((n) => (
                  <span
                    key={n}
                    className={"h-1.5 w-8 rounded-full transition-all duration-500 " + (n < steps.length ? "bg-primary shadow-[0_0_8px_rgb(var(--lamp)/0.7)]" : "scale-x-75 bg-[rgb(var(--rule))]")}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

const INPUT = "min-h-[44px] w-full rounded-xl border border-[rgb(var(--rule))] bg-obsidian/50 px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-dim transition focus:border-primary/50 focus:outline-none disabled:opacity-60";
const SMALL = "min-h-[40px] w-full rounded-xl border border-[rgb(var(--rule))] bg-obsidian/50 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:border-primary/50 focus:outline-none";
const ICON_BTN = "grid h-10 w-10 place-items-center rounded-xl text-text-muted transition hover:bg-white/[0.05] hover:text-text-primary disabled:opacity-30 sm:h-9 sm:w-9";

function Field({ label, hint, inline = false, children }) {
  return (
    <label className={"block " + (inline ? "" : "mt-4")}>
      <span className="text-[13px] font-medium text-text-muted">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs text-text-dim">{hint}</p>}
    </label>
  );
}

function StepEditor({ step, index, isFirst, isLast, readOnly, onUpdate, onDelete, onMoveUp, onMoveDown }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState({
    title:          step.title || "",
    description:    step.description || "",
    resource_url:   step.resource_url || "",
    resource_label: step.resource_label || "",
    est_minutes:    step.est_minutes ?? "",
  });

  const onSave = useCallback(() => {
    onUpdate({
      title:          local.title,
      description:    local.description,
      resource_url:   local.resource_url || null,
      resource_label: local.resource_label || null,
      est_minutes:    local.est_minutes === "" ? null : Number(local.est_minutes),
    });
    setOpen(false);
  }, [local, onUpdate]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: -60, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={"lamp-panel p-3 sm:p-4 " + (open ? "border-primary/35" : "")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex items-start gap-3 sm:contents">
          <motion.span
            layout="position"
            className="lamp-numerals grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[rgb(var(--rule))] text-sm text-text-muted"
          >
            {index + 1}
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-text-primary">{step.title}</p>
            {step.description && <p className="mt-1 line-clamp-2 text-sm leading-5 text-text-muted">{step.description}</p>}
            {(step.problem || step.resource_url || step.est_minutes) ? (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-dim">
                {step.problem && <span className="text-primary">Problem: {step.problem.title?.slice(0, 30)}</span>}
                {step.resource_url && (
                  <span className="inline-flex max-w-full items-center gap-1 truncate">
                    <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">{step.resource_label || step.resource_url}</span>
                  </span>
                )}
                {step.est_minutes ? <span>{step.est_minutes} min</span> : null}
              </div>
            ) : null}
          </div>
        </div>
        {/* Actions row — wraps to its own line on mobile so the step
            content has the full width to itself. */}
        <div className="flex shrink-0 items-center justify-end gap-1">
          <button type="button" onClick={onMoveUp}   disabled={readOnly || isFirst} aria-label="Move step up"   className={ICON_BTN}><ArrowUp className="h-4 w-4" strokeWidth={1.75} /></button>
          <button type="button" onClick={onMoveDown} disabled={readOnly || isLast}  aria-label="Move step down" className={ICON_BTN}><ArrowDown className="h-4 w-4" strokeWidth={1.75} /></button>
          <button type="button" onClick={() => setOpen((v) => !v)} disabled={readOnly} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-text-muted transition hover:bg-white/[0.05] hover:text-text-primary disabled:opacity-50 sm:min-h-[36px]">
            {open ? <X className="h-3.5 w-3.5" strokeWidth={1.75} /> : <PenLine className="h-3.5 w-3.5" strokeWidth={1.75} />}
            {open ? "Cancel" : "Edit"}
          </button>
          <button type="button" onClick={onDelete} disabled={readOnly} aria-label="Delete step" className={ICON_BTN + " hover:!bg-danger/10 hover:!text-danger"}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
        </div>
      </div>

      <AnimatePresence>
        {open && !readOnly && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-2 border-t border-[rgb(var(--rule))] pt-4">
              <input
                value={local.title}
                onChange={(e) => setLocal((l) => ({ ...l, title: e.target.value }))}
                placeholder="Step title"
                maxLength={200}
                className={SMALL}
              />
              <textarea
                value={local.description}
                onChange={(e) => setLocal((l) => ({ ...l, description: e.target.value }))}
                rows={3} maxLength={2000} placeholder="Description (optional)"
                className={SMALL + " resize-y leading-6"}
              />
              <div className="grid gap-2 sm:grid-cols-[1fr_140px_100px]">
                <input
                  value={local.resource_url}
                  onChange={(e) => setLocal((l) => ({ ...l, resource_url: e.target.value }))}
                  placeholder="Resource URL (optional)" maxLength={500}
                  className={SMALL + " font-mono text-xs"}
                />
                <input
                  value={local.resource_label}
                  onChange={(e) => setLocal((l) => ({ ...l, resource_label: e.target.value }))}
                  placeholder="Resource label" maxLength={120}
                  className={SMALL}
                />
                <input
                  type="number" min={0} max={10000}
                  value={local.est_minutes}
                  onChange={(e) => setLocal((l) => ({ ...l, est_minutes: e.target.value }))}
                  placeholder="Mins"
                  className={SMALL + " text-center tabular-nums"}
                />
              </div>
              <div className="flex items-center justify-end">
                <button type="button" onClick={onSave} className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-[rgb(var(--color-obsidian))] transition hover:brightness-110 active:scale-[0.97]">
                  <Check className="h-4 w-4" strokeWidth={2} />
                  Save step
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
