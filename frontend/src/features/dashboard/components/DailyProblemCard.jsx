/**
 * DailyProblemCard — the lit panel on the dashboard.
 *
 * Surfaces a single rotating problem (same for everyone globally) and
 * the viewer's check-in streak. The check-in is intentionally low-
 * pressure: clicking "I checked it out" bumps the streak. It doesn't
 * require finishing the problem — the daily rhythm is what we want
 * to reward, not the solve itself.
 *
 * Streak math lives in the backend (problemController.dailyCheckin).
 * The widget just calls /api/problems/daily once on mount, then
 * /api/problems/daily/checkin when the user clicks the streak button.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight, Check, Flame, Plus } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { problems } from "@/lib/api";
import Button from "@/components/ui/Button";

export default function DailyProblemCard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [busy,    setBusy]    = useState(false);
  const root = useRef(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    problems.daily({ signal: ctrl.signal })
      .then(({ data }) => { setData(data); setLoading(false); })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        setError(err?.response?.data?.error || "Couldn't load today's problem");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  // Streak burst: when the check-in lands, eight sparks fly out of the
  // flame and the panel's warm corner flares once.
  const { contextSafe } = useGSAP({ scope: root });
  const burst = contextSafe(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sparks = root.current?.querySelectorAll("[data-spark]");
    if (!sparks?.length) return;
    gsap.fromTo(sparks,
      { x: 0, y: 0, scale: 1, autoAlpha: 1 },
      {
        x: (i) => Math.cos((i / sparks.length) * Math.PI * 2) * 34,
        y: (i) => Math.sin((i / sparks.length) * Math.PI * 2) * 34,
        scale: 0, autoAlpha: 0, duration: 0.8, ease: "expo.out",
      });
    gsap.fromTo(root.current.querySelector("[data-flare]"), { autoAlpha: 0.9 }, { autoAlpha: 0, duration: 1.2, ease: "power2.out" });
  });

  async function onCheckin() {
    if (busy || !data || data.checked_in_today) return;
    setBusy(true);
    try {
      const { data: resp } = await problems.dailyCheckin();
      setData((d) => ({
        ...d,
        streak_days:      resp.streak_days,
        streak_last_date: resp.streak_last_date,
        checked_in_today: true,
      }));
      burst();
    } catch {
      // best-effort — leave state alone, the user can retry
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="lamp-panel lamp-panel--lit p-6 sm:p-8">
        <div className="h-4 w-32 animate-pulse rounded bg-white/[0.05]" />
        <div className="mt-4 h-8 w-3/4 animate-pulse rounded bg-white/[0.05]" />
        <div className="mt-6 h-12 w-44 animate-pulse rounded-xl bg-white/[0.05]" />
      </div>
    );
  }

  if (error || !data?.problem) {
    return null; // hide quietly — don't blow up the dashboard
  }

  const p = data.problem;
  const href = `/problems/${encodeURIComponent(p.slug || p.id)}`;

  return (
    <section ref={root} data-reveal="scale" className="lamp-panel lamp-panel--lit relative overflow-hidden p-6 sm:p-8">
      <span
        data-flare
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-0 blur-2xl"
        style={{ background: "radial-gradient(circle, rgb(var(--lamp)/0.55), transparent 70%)" }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-primary">Today&apos;s problem</p>
        <StreakBadge days={data.streak_days} />
      </div>

      <Link to={href} className="group relative mt-3 block">
        <h2
          className="lamp-display text-2xl leading-tight text-text-primary transition-colors group-hover:text-primary sm:text-[2rem]"
          style={{ textWrap: "balance" }}
        >
          {p.title}
        </h2>
      </Link>
      <div className="relative mt-3 flex flex-wrap items-center gap-2">
        {[p.source, p.difficulty, p.domain].filter(Boolean).map((tag) => (
          <span key={tag} className="rounded-full border border-[rgb(var(--rule))] px-2.5 py-1 text-[12px] capitalize text-text-muted">
            {tag}
          </span>
        ))}
      </div>

      <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link to={href} className="sm:w-auto">
          <Button size="lg" className="w-full justify-center sm:w-auto" trailing={<ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />}>
            Open problem
          </Button>
        </Link>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={onCheckin}
          disabled={busy || data.checked_in_today}
          className={
            "relative inline-flex h-12 items-center justify-center gap-2 rounded-[0.9rem] border px-4 text-sm font-medium transition " +
            (data.checked_in_today
              ? "cursor-default border-success/35 bg-success/10 text-success"
              : "border-[rgb(var(--rule))] bg-surface/60 text-text-primary hover:border-primary/45 hover:bg-primary/[0.06]")
          }
        >
          <span aria-hidden="true" className="pointer-events-none absolute left-6 top-1/2">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} data-spark className="absolute h-1.5 w-1.5 rounded-full bg-primary opacity-0" />
            ))}
          </span>
          {data.checked_in_today
            ? <><Check className="h-4 w-4" strokeWidth={1.75} /> Checked in today</>
            : <><Plus className="h-4 w-4" strokeWidth={1.75} /> Add a day to my streak</>}
        </motion.button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */

function StreakBadge({ days }) {
  if (!days || days < 1) {
    return (
      <span className="text-[13px] text-text-dim">No streak yet</span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[13px] font-medium text-primary"
      title={`Current daily streak: ${days} day${days === 1 ? "" : "s"}`}
    >
      <Flame className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      <span className="relative inline-flex overflow-hidden tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={days}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
          >
            {days}
          </motion.span>
        </AnimatePresence>
      </span>
      <span>day{days === 1 ? "" : "s"}</span>
    </span>
  );
}
