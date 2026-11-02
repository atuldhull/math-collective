/**
 * EventChips — Lamplight status / type / note chips for the events page.
 *
 * Sentence-case labels, lucide icons, and a live pulse for anything
 * happening right now. Kept local to the events feature so the shared
 * ui badges (used by admin pages) are left alone.
 */
import { BookOpen, CalendarDays, Code2, Trophy, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";

const STATUS = {
  active:      { label: "Live now",          tone: "text-success border-success/35 bg-success/10", live: true },
  registering: { label: "Registration open", tone: "text-primary border-primary/35 bg-primary/10" },
  upcoming:    { label: "Upcoming",          tone: "text-secondary border-secondary/30 bg-secondary/10" },
  completed:   { label: "Completed",         tone: "text-text-dim border-[rgb(var(--rule))] bg-white/[0.03]" },
  past:        { label: "Past",              tone: "text-text-dim border-[rgb(var(--rule))] bg-white/[0.03]" },
  closed:      { label: "Closed",            tone: "text-text-muted border-[rgb(var(--rule))] bg-white/[0.03]" },
  cancelled:   { label: "Cancelled",         tone: "text-danger border-danger/30 bg-danger/10" },
  waitlisted:  { label: "Waitlisted",        tone: "text-warning border-warning/30 bg-warning/10" },
};

export const TYPE_META = {
  competition: { label: "Competition", icon: Trophy },
  hackathon:   { label: "Hackathon",   icon: Code2 },
  workshop:    { label: "Workshop",    icon: Wrench },
  seminar:     { label: "Seminar",     icon: BookOpen },
  general:     { label: "Event",       icon: CalendarDays },
};

const base = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium leading-none";

export function StatusChip({ status }) {
  const s = STATUS[status] || STATUS.upcoming;
  return (
    <span className={cn(base, s.tone)}>
      {s.live ? (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success shadow-[0_0_8px_rgb(var(--color-success))]" />
        </span>
      ) : null}
      {s.label}
    </span>
  );
}

export function TypeChip({ type }) {
  const t = TYPE_META[(type || "general").toLowerCase()] || TYPE_META.general;
  const Icon = t.icon;
  return (
    <span className={cn(base, "border-[rgb(var(--rule))] bg-white/[0.03] text-text-muted")}>
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      {t.label}
    </span>
  );
}

const NOTE_TONES = {
  good: "text-success border-success/30 bg-success/10",
  warn: "text-warning border-warning/30 bg-warning/10",
  bad: "text-danger border-danger/30 bg-danger/10",
  violet: "text-secondary border-secondary/30 bg-secondary/10",
  lamp: "text-primary border-primary/30 bg-primary/10",
};

export function NoteChip({ tone = "lamp", icon: Icon, children }) {
  return (
    <span className={cn(base, NOTE_TONES[tone] || NOTE_TONES.lamp)}>
      {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
