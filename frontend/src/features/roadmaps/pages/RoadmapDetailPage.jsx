/**
 * RoadmapDetailPage — /roadmaps/:slug
 *
 * The roadmap drawn as a vertical path (see StepPath). Each step is either:
 *   • A problem reference (links into /problems/:slug for the deep dive)
 *   • A resource link (opens externally)
 *   • A free-form checkpoint
 *
 * Clicking the checkbox toggles per-step completion. The progress
 * bar at the top updates locally on every toggle; the backend
 * roadmap_progress row is created/deleted in the background.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowLeft, Check, Clock, Compass, ExternalLink, PenLine, Target } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { roadmaps as roadmapsApi } from "@/lib/api";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { PageHeader, EmptyState } from "@/components/lamp";
import { DifficultyMeter } from "@/features/problems/components/ProblemMeta";

export default function RoadmapDetailPage() {
  const { slug } = useParams();
  const [state, setState] = useState({ roadmap: null, loading: true, error: null });
  const [busy, setBusy] = useState(new Set()); // step ids in flight

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ roadmap: null, loading: true, error: null });
    roadmapsApi.get(slug, { signal: ctrl.signal })
      .then(({ data }) => setState({ roadmap: data, loading: false, error: null }))
      .catch((err) => {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        setState({
          roadmap: null, loading: false,
          error: err?.response?.status === 404 ? "not-found" : (err?.response?.data?.error || "Couldn't load roadmap"),
        });
      });
    return () => ctrl.abort();
  }, [slug]);

  const onToggle = useCallback(async (stepId) => {
    if (busy.has(stepId)) return;
    setBusy((s) => new Set(s).add(stepId));

    // Optimistic flip + recount.
    setState((st) => {
      if (!st.roadmap) return st;
      const steps = st.roadmap.steps.map((s) =>
        s.id === stepId ? { ...s, done: !s.done } : s,
      );
      const done_count = steps.filter((s) => s.done).length;
      return { ...st, roadmap: { ...st.roadmap, steps, done_count } };
    });

    try {
      await roadmapsApi.toggleStep(stepId);
    } catch {
      // Roll back
      setState((st) => {
        if (!st.roadmap) return st;
        const steps = st.roadmap.steps.map((s) =>
          s.id === stepId ? { ...s, done: !s.done } : s,
        );
        const done_count = steps.filter((s) => s.done).length;
        return { ...st, roadmap: { ...st.roadmap, steps, done_count } };
      });
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(stepId);
        return next;
      });
    }
  }, [busy]);

  if (state.loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader variant="orbit" /></div>;
  }

  if (state.error === "not-found") {
    return (
      <div className="mx-auto w-full max-w-2xl py-12">
        <EmptyState
          title="Roadmap not found."
          body="It may have been unpublished or renamed. Pick another path from the list."
          action={
            <Link
              to="/roadmaps"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-medium text-primary transition hover:bg-primary/15"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              All roadmaps
            </Link>
          }
        />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="mx-auto w-full max-w-2xl py-12">
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-sm text-danger">
          {state.error}
        </div>
      </div>
    );
  }

  const r = state.roadmap;
  const pct  = r.step_count > 0 ? Math.round((r.done_count / r.step_count) * 100) : 0;

  return (
    <article className="mx-auto w-full max-w-4xl pb-20">
      <div className="mb-5 flex items-center justify-between">
        <Link
          to="/roadmaps"
          className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-text-muted transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Roadmaps
        </Link>
      </div>

      {/* ── Header ── */}
      <PageHeader
        context={r.topic}
        title={r.title}
        description={r.summary}
        progress={r.step_count > 0 ? r.done_count / r.step_count : 0}
        actions={r.is_owner ? (
          <Link
            to={`/roadmaps/${encodeURIComponent(r.slug)}/edit`}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-4 text-sm font-medium text-text-primary transition hover:border-primary/40"
          >
            <PenLine className="h-4 w-4" strokeWidth={1.75} />
            Edit
          </Link>
        ) : null}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.04] text-2xl leading-none" aria-hidden="true">
            {r.cover_emoji || <Compass className="h-5 w-5 text-primary" strokeWidth={1.75} />}
          </span>
          <DifficultyMeter level={r.difficulty} />
          {r.est_hours ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-text-dim" strokeWidth={1.75} />
              About {r.est_hours} hours
            </span>
          ) : null}
          {r.author && (
            <span className="inline-flex items-center gap-1.5">
              By {r.author.handle ? (
                <Link to={`/u/${r.author.handle}`} className="text-primary hover:underline">@{r.author.handle}</Link>
              ) : <span className="text-text-primary">{r.author.name || "a student"}</span>}
              {r.submission_status !== "approved" && (
                <span className="ml-1 rounded-lg bg-warning/10 px-2 py-0.5 text-xs font-medium capitalize text-warning ring-1 ring-warning/30">
                  {r.submission_status}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Progress */}
        <div className="lamp-panel lamp-panel--lit mt-5 p-4 sm:p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-text-muted">Your progress</p>
              <p className="mt-1 text-sm text-text-primary">
                <span className="lamp-numerals">{r.done_count}</span> of <span className="lamp-numerals">{r.step_count}</span> steps done
              </p>
            </div>
            <p className="lamp-numerals text-3xl text-primary sm:text-4xl">
              <AnimatedNumber value={pct} suffix="%" duration={0.9} />
            </p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full bg-primary shadow-[0_0_14px_rgb(var(--lamp)/0.7)]"
            />
          </div>
        </div>
      </PageHeader>

      {/* ── Description ── */}
      {r.description && (
        <p data-reveal="fade" className="max-w-[66ch] text-[1.0625rem] leading-[1.8] text-text-primary/85">{r.description}</p>
      )}

      {/* ── Steps path ── */}
      <StepPath steps={r.steps} busy={busy} onToggle={onToggle} />
    </article>
  );
}

/* ─────────────────────────────────────────────────────────── */

/**
 * StepPath — the roadmap drawn as a path. A lamp line draws down the
 * rail as you scroll (scrubbed), and each node lights up as the line
 * reaches it. Completed steps glow in the accent whatever the scroll.
 */
function StepPath({ steps, busy, onToggle }) {
  const root = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    const q = gsap.utils.selector(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(q("[data-draw]"), { scaleY: 0 }, {
        scaleY: 1,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top 65%", end: "bottom 65%", scrub: 0.6 },
      });
      q("[data-step]").forEach((li) => {
        ScrollTrigger.create({
          trigger: li,
          start: "top 65%",
          toggleClass: { targets: li, className: "is-lit" },
        });
      });
    });
    mm.add("(prefers-reduced-motion: reduce)", () => {
      q("[data-step]").forEach((li) => li.classList.add("is-lit"));
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [steps.length], revertOnUpdate: true });

  return (
    <ol ref={root} className="relative mt-10 space-y-5 pl-12 sm:pl-16">
      {/* Rail + the lamp line that draws along it */}
      <span aria-hidden="true" className="absolute bottom-6 left-[19px] top-6 w-0.5 rounded-full bg-[rgb(var(--rule))] sm:left-[27px]" />
      <span
        data-draw
        aria-hidden="true"
        className="absolute bottom-6 left-[19px] top-6 w-0.5 origin-top rounded-full bg-[linear-gradient(rgb(var(--lamp)),rgb(var(--lamp)/0.35))] shadow-[0_0_12px_rgb(var(--lamp)/0.7)] sm:left-[27px]"
      />
      {steps.map((step, i) => (
        <StepRow
          key={step.id}
          step={step}
          index={i}
          onToggle={() => onToggle(step.id)}
          disabled={busy.has(step.id)}
        />
      ))}
    </ol>
  );
}

function StepRow({ step, index, onToggle, disabled }) {
  return (
    <li data-step className="group/step relative">
      {/* Node on the rail: dim until the line reaches it, then lit in the second accent; the accent when done. */}
      <motion.button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        whileTap={{ scale: 0.85 }}
        aria-label={step.done ? "Mark step incomplete" : "Mark step complete"}
        aria-pressed={Boolean(step.done)}
        className={
          "absolute -left-12 top-4 z-[1] grid h-10 w-10 place-items-center rounded-full border-2 text-sm font-semibold transition-[background-color,border-color,box-shadow,color] duration-500 sm:-left-16 sm:h-14 sm:w-14 sm:text-base " +
          (step.done
            ? "border-primary bg-primary text-[rgb(var(--color-obsidian))] shadow-[0_0_0_6px_rgb(var(--lamp)/0.14),0_0_28px_rgb(var(--lamp)/0.75)]"
            : "border-[rgb(var(--rule))] bg-obsidian text-text-dim hover:border-primary/60 group-[.is-lit]/step:border-secondary group-[.is-lit]/step:text-text-primary group-[.is-lit]/step:shadow-[0_0_20px_rgb(var(--violet)/0.45)]")
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {step.done ? (
            <motion.span
              key="done"
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 16 }}
              className="inline-flex"
            >
              <Check className="h-5 w-5" strokeWidth={2.5} />
            </motion.span>
          ) : (
            <motion.span
              key="num"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="lamp-numerals"
            >
              {index + 1}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <div
        className={
          "lamp-panel p-4 transition-[border-color,box-shadow,opacity] duration-500 sm:p-5 " +
          (step.done
            ? "border-primary/35 shadow-[0_0_40px_-18px_rgb(var(--lamp)/0.8)]"
            : "opacity-80 group-[.is-lit]/step:opacity-100")
        }
      >
        <p className={"text-base font-semibold leading-snug transition-colors " + (step.done ? "text-primary" : "text-text-primary")}>
          {step.title}
        </p>
        {step.description && (
          <p className="mt-1.5 max-w-[66ch] text-sm leading-6 text-text-muted">{step.description}</p>
        )}

        {(step.problem || step.resource_url || step.est_minutes) ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {step.problem && (
              <Link
                to={`/problems/${encodeURIComponent(step.problem.slug || step.problem.id)}`}
                className="inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-xl bg-primary/10 px-3 text-[13px] font-medium text-primary ring-1 ring-primary/30 transition hover:bg-primary/15"
              >
                <Target className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">Problem: {step.problem.title.slice(0, 40)}{step.problem.title.length > 40 ? "…" : ""}</span>
              </Link>
            )}
            {step.resource_url && (
              <a
                href={step.resource_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-xl border border-[rgb(var(--rule))] px-3 text-[13px] font-medium text-text-muted transition hover:border-primary/40 hover:text-text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{step.resource_label || "Resource"}</span>
              </a>
            )}
            {step.est_minutes ? (
              <span className="inline-flex items-center gap-1 text-xs text-text-dim">
                <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                About {step.est_minutes} min
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
