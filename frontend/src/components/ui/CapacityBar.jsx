/**
 * CapacityBar — visual fill bar showing registration capacity.
 *
 * Uses the event-capacity-bar CSS classes from theme.css.
 * Shows count/capacity label and changes color when >80% or full.
 *
 * memo (Phase 13) — every event card on the events page renders one.
 * Props are three primitives (current:number, max:number|null,
 * className:string), so the default shallow compare is correct and
 * skips re-renders when the row's counts haven't changed.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { useIsLamplight } from "@/components/lamp/SkinProvider";

function CapacityBar({ current = 0, max = null, className = "" }) {
  const lamp = useIsLamplight();
  if (lamp) return <LampCapacityBar current={current} max={max} className={className} />;
  if (max === null || max === undefined) {
    return (
      <span className={`font-mono text-[10px] text-text-dim ${className}`}>
        {current} registered · Unlimited
      </span>
    );
  }

  const pct = Math.min(100, Math.round((current / max) * 100));
  const warn = pct >= 80;
  const full = pct >= 100;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="truncate font-mono text-[10px] text-text-dim">
          {current} / {max} registered
        </span>
        {/* tabular-nums + min-w keep the percentage right-aligned in a
            stable column instead of shifting 1px each time the count
            ticks up by 10/100/... Also prevents visual overlap with
            the left label on narrow cards. */}
        <span className={`math-text shrink-0 text-right tabular-nums text-[11px] font-bold [min-width:2.5rem] ${
          full ? "text-danger" : warn ? "text-warning" : "text-success"
        }`}>
          {pct}%
        </span>
      </div>
      <div className="event-capacity-bar">
        <div
          className="event-capacity-bar-fill"
          data-warn={warn && !full}
          data-full={full}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default memo(CapacityBar);

// Lamplight: a thin rule that fills from the left on mount (the track is
// unmasked with a clip-path sweep, so the fill keeps its exact width for
// anything reading style.width), the accent by default, warning near full,
// danger when full.
function LampCapacityBar({ current, max, className }) {
  if (max === null || max === undefined) {
    return (
      <span className={`text-[12px] text-text-muted ${className}`}>
        {current} registered · Unlimited
      </span>
    );
  }
  const pct = Math.min(100, Math.round((current / max) * 100));
  const warn = pct >= 80;
  const full = pct >= 100;
  const tone = full ? "var(--color-danger)" : warn ? "var(--color-warning)" : "var(--lamp)";
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="truncate text-[12px] text-text-muted">
          {current} / {max} registered
        </span>
        <span
          className="lamp-numerals shrink-0 text-right text-[12px] [min-width:2.5rem]"
          style={{ color: `rgb(${tone})` }}
        >
          {pct}%
        </span>
      </div>
      <motion.div
        className="h-1.5 overflow-hidden rounded-full bg-[rgb(var(--rule))]"
        initial={{ clipPath: "inset(0 100% 0 0 round 999px)" }}
        animate={{ clipPath: "inset(0 0% 0 0 round 999px)" }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      >
        <div
          className="event-capacity-bar-fill h-full rounded-full"
          data-warn={warn && !full}
          data-full={full}
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, rgb(${tone} / 0.55), rgb(${tone}))`,
            boxShadow: `0 0 12px rgb(${tone} / 0.45)`,
          }}
        />
      </motion.div>
    </div>
  );
}
