/**
 * EventStatusBadge — colored pill badge for event lifecycle status.
 *
 * Uses the event status color tokens from theme.css.
 * Follows the same clip-path + mono font pattern as difficulty badges.
 *
 * Wrapped in React.memo (Phase 13): this component is rendered inside
 * event-list maps where the parent re-renders on any state change
 * (filter toggles, search input, polling). With memo and stable props
 * the entire badge tree skips reconciliation when status doesn't
 * change. Props are primitive (status:string, className:string) so
 * the default shallow compare is the right equality check.
 */

import { memo } from "react";
import { useIsLamplight } from "@/components/lamp/SkinProvider";

const STATUS_CONFIG = {
  registering: { label: "Registering", color: "rgb(var(--event-registering))", bg: "rgb(var(--event-registering)/0.12)", border: "rgb(var(--event-registering)/0.3)" },
  active:      { label: "Live Now",    color: "rgb(var(--event-active))",      bg: "rgb(var(--event-active)/0.12)",      border: "rgb(var(--event-active)/0.3)" },
  completed:   { label: "Completed",   color: "rgb(var(--event-completed))",   bg: "rgb(var(--event-completed)/0.10)",   border: "rgb(var(--event-completed)/0.2)" },
  closed:      { label: "Closed",      color: "rgb(var(--event-closed))",      bg: "rgb(var(--event-closed)/0.12)",      border: "rgb(var(--event-closed)/0.3)" },
  cancelled:   { label: "Cancelled",   color: "rgb(var(--event-cancelled))",   bg: "rgb(var(--event-cancelled)/0.12)",   border: "rgb(var(--event-cancelled)/0.3)" },
  waitlisted:  { label: "Waitlisted",  color: "rgb(var(--event-waitlisted))",  bg: "rgb(var(--event-waitlisted)/0.12)",  border: "rgb(var(--event-waitlisted)/0.3)" },
  upcoming:    { label: "Upcoming",    color: "rgb(var(--event-upcoming))",    bg: "rgb(var(--event-upcoming)/0.12)",    border: "rgb(var(--event-upcoming)/0.3)" },
  past:        { label: "Past",        color: "rgb(var(--event-completed))",   bg: "rgb(var(--event-completed)/0.08)",   border: "rgb(var(--event-completed)/0.15)" },
};

const LAMP_VAR = {
  registering: "--event-registering",
  active:      "--event-active",
  completed:   "--event-completed",
  closed:      "--event-closed",
  cancelled:   "--event-cancelled",
  waitlisted:  "--event-waitlisted",
  upcoming:    "--event-upcoming",
  past:        "--event-completed",
};

function EventStatusBadge({ status, className = "" }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
  const lamp = useIsLamplight();

  if (lamp) {
    // Lamplight: sentence-case pill with a status dot; "Live now" pulses.
    const varName = LAMP_VAR[status] || LAMP_VAR.upcoming;
    const live = status === "active";
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${className}`}
        style={{
          color: `rgb(var(${varName}))`,
          background: `rgb(var(${varName}) / 0.1)`,
          border: `1px solid rgb(var(${varName}) / 0.28)`,
        }}
      >
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          {live ? <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60" /> : null}
          <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
        </span>
        {config.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-block font-mono text-[10px] uppercase tracking-[0.2em] ${className}`}
      style={{
        clipPath: "var(--clip-para)",
        padding: "0.2rem 0.75rem",
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      {config.label}
    </span>
  );
}

export default memo(EventStatusBadge);
