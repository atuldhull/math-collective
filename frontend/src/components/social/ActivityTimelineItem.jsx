/**
 * ActivityTimelineItem — one row in the merged events + achievements
 * feed rendered on the profile Overview + Activity tabs.
 *
 * Input shape matches /api/users/:id/activity items:
 *   { kind: "event" | "achievement", at: ISO-string, data: {...} }
 *
 * Display rules
 * ─────────────
 *   event:
 *     - icon comes from event_type → emoji table below
 *     - title is the event name, subtitle is "registered" | "attended" | "no_show"
 *     - clicking navigates to /events (could later deep-link to the event id)
 *   achievement:
 *     - icon comes from the achievement row (stored in DB)
 *     - title is the achievement title, subtitle shows +XP
 *     - rarity drives a subtle glow colour (common / uncommon / ...)
 *
 * The rarity colour palette deliberately uses Tailwind classes over
 * inline style so the cosmic / light / eclipse themes override
 * correctly without a per-item theme prop.
 */

import { Link } from "react-router-dom";
import { Award, CalendarDays, Laptop, Mic, PartyPopper, Trophy, Wrench } from "lucide-react";
import { useIsLamplight } from "@/components/lamp/SkinProvider";
import { cn } from "@/lib/cn";

const LAMP_EVENT_ICONS = {
  general:     CalendarDays,
  hackathon:   Laptop,
  workshop:    Wrench,
  competition: Trophy,
  seminar:     Mic,
  social:      PartyPopper,
};

const LAMP_RARITY = {
  common:    "border-[rgb(var(--rule))]",
  uncommon:  "border-success/40",
  rare:      "border-secondary/50",
  epic:      "border-[rgb(var(--lamp)/0.5)]",
  legendary: "border-warning/70 shadow-[0_0_18px_-4px_rgb(var(--lamp)/0.7)]",
};

// Emoji table for event_type values. Fallback is a generic calendar.
// Matches the filters used on EventsPage so the visual language is
// consistent across the profile feed and the events page.
const EVENT_ICONS = {
  general:     "📅",
  hackathon:   "💻",
  workshop:    "🛠️",
  competition: "🏆",
  seminar:     "🎤",
  social:      "🎉",
};

const RARITY_GLOW = {
  common:    "",
  uncommon:  "ring-1 ring-success/30",
  rare:      "ring-1 ring-secondary/30",
  epic:      "ring-1 ring-primary/40",
  legendary: "ring-2 ring-warning/50",
};

/** Short relative time: "2h ago" / "3d ago" / "Mar 15, 2026". */
function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return new Date(iso).toLocaleDateString();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * @param {{ item: { kind: "event" | "achievement", at: string, data: any } }} props
 */
export default function ActivityTimelineItem({ item }) {
  const lamp = useIsLamplight();
  if (!item) return null;
  if (lamp) return <LampItem item={item} />;

  if (item.kind === "event") {
    const d = item.data || {};
    const icon = EVENT_ICONS[d.event_type] || EVENT_ICONS.general;
    const statusLabel =
      d.status === "attended"  ? "Attended" :
      d.status === "no_show"   ? "Missed"   :
      d.status === "cancelled" ? "Cancelled" :
                                 "Registered for";
    const body = (
      <>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel/60 text-xl">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white truncate">
            <span className="text-text-dim">{statusLabel}</span>{" "}
            <span className="font-medium">{d.title || "an event"}</span>
          </p>
          <p className="font-mono text-[10px] text-text-dim">{timeAgo(item.at)}</p>
        </div>
      </>
    );
    return d.event_id
      ? <Link to="/events" className="flex items-center gap-3 py-2 transition hover:opacity-80">{body}</Link>
      : <div className="flex items-center gap-3 py-2">{body}</div>;
  }

  if (item.kind === "achievement") {
    const d = item.data || {};
    const glow = RARITY_GLOW[d.rarity] || "";
    return (
      <div className="flex items-center gap-3 py-2">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel/60 text-xl ${glow}`}>
          {d.icon || "🏅"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white truncate">
            <span className="text-text-dim">Unlocked</span>{" "}
            <span className="font-medium">{d.title || "an achievement"}</span>
            {d.xp_awarded > 0 && (
              <span className="ml-2 math-text text-[11px] text-primary">+{d.xp_awarded} XP</span>
            )}
          </p>
          <p className="font-mono text-[10px] text-text-dim">{timeAgo(item.at)}</p>
        </div>
      </div>
    );
  }

  // Unknown kind — silently skip rather than crash. Forward-compat
  // for future timeline item types.
  return null;
}

/* Lamplight: a ledger line. Icon tile, sentence, quiet timestamp. */
function LampItem({ item }) {
  const d = item.data || {};
  if (item.kind === "event") {
    const Icon = LAMP_EVENT_ICONS[d.event_type] || LAMP_EVENT_ICONS.general;
    const statusLabel =
      d.status === "attended"  ? "Attended" :
      d.status === "no_show"   ? "Missed"   :
      d.status === "cancelled" ? "Cancelled" :
                                 "Registered for";
    const body = (
      <>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[rgb(var(--rule))] bg-surface/60 text-text-muted transition-colors group-hover:text-primary">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-text-primary">
            <span className="text-text-muted">{statusLabel}</span>{" "}
            <span className="font-medium">{d.title || "an event"}</span>
          </p>
          <p className="text-[12px] text-text-dim">{timeAgo(item.at)}</p>
        </div>
      </>
    );
    return d.event_id
      ? <Link to="/events" className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[rgb(var(--lamp)/0.05)]">{body}</Link>
      : <div className="flex items-center gap-3 py-2">{body}</div>;
  }

  if (item.kind === "achievement") {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-surface/60 text-xl", LAMP_RARITY[d.rarity] || LAMP_RARITY.common)}>
          {d.icon || <Award className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-text-primary">
            <span className="text-text-muted">Unlocked</span>{" "}
            <span className="font-medium">{d.title || "an achievement"}</span>
            {d.xp_awarded > 0 && (
              <span className="lamp-numerals ml-2 text-[12px] text-primary">+{d.xp_awarded} XP</span>
            )}
          </p>
          <p className="text-[12px] text-text-dim">{timeAgo(item.at)}</p>
        </div>
      </div>
    );
  }
  return null;
}
