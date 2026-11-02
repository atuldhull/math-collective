/**
 * EventExplorer — pick a kind of event to filter the timeline.
 *
 * Five tilting Lamplight tiles (all, competitions, hackathons,
 * workshops, seminars). Each carries its own glyph, an icon and a live
 * count; the active tile warms up and a lamp dot slides to it (framer
 * layoutId). Clicking sets the type filter and scrolls to the list.
 */
import { motion } from "framer-motion";
import { Infinity as InfinityIcon } from "lucide-react";
import { TiltPanel } from "@/components/lamp";
import { cn } from "@/lib/cn";
import { TYPE_META } from "./EventChips";

const CATEGORIES = [
  { key: "all", label: "All events", symbol: "∞", description: "Everything on the calendar", icon: InfinityIcon },
  { key: "competition", label: "Competitions", symbol: "#1", description: "Timed rounds, ranked results", icon: TYPE_META.competition.icon },
  { key: "hackathon", label: "Hackathons", symbol: "∀", description: "Build something overnight", icon: TYPE_META.hackathon.icon },
  { key: "workshop", label: "Workshops", symbol: "∂", description: "Learn it hands-on", icon: TYPE_META.workshop.icon },
  { key: "seminar", label: "Seminars", symbol: "∫", description: "Talks and deep dives", icon: TYPE_META.seminar.icon },
];

export default function EventExplorer({ activeFilter, onFilterChange, eventCounts = {}, onExplore }) {
  return (
    <section aria-labelledby="event-kinds" className="mx-auto w-full max-w-6xl">
      <h2 id="event-kinds" data-reveal="fade" className="mb-4 text-lg text-text-primary sm:text-xl">
        Pick a kind of event
      </h2>

      <div data-stagger="tilt" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {CATEGORIES.map((cat, i) => {
          const isActive = activeFilter === cat.key;
          const Icon = cat.icon;
          const count = cat.key === "all"
            ? Object.values(eventCounts).reduce((s, v) => s + v, 0)
            : (eventCounts[cat.key] || 0);

          return (
            <TiltPanel
              key={cat.key}
              as="button"
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                onFilterChange(cat.key);
                onExplore?.();
              }}
              className={cn(
                "group min-h-[7.5rem] overflow-hidden p-4 text-left transition-[border-color,box-shadow] duration-500",
                i === 0 && "col-span-2 sm:col-span-1",
                isActive
                  ? "border-primary/45 shadow-[0_0_40px_-12px_rgb(var(--lamp)/0.6)]"
                  : "hover:border-primary/25",
              )}
            >
              {/* glyph watermark */}
              <span
                aria-hidden="true"
                className={cn(
                  "lamp-display pointer-events-none absolute -bottom-3 right-2 text-[4.5rem] leading-none transition-all duration-700 ease-[var(--ease-lamp)] group-hover:-translate-y-1 group-hover:scale-110",
                  isActive ? "text-primary/25" : "text-text-primary/[0.06]",
                )}
              >
                {cat.symbol}
              </span>

              {isActive ? (
                <motion.span
                  layoutId="explorer-dot"
                  aria-hidden="true"
                  className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgb(var(--lamp)/0.9)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              ) : null}

              <span className="relative flex items-center gap-2">
                <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-text-dim")} strokeWidth={1.75} aria-hidden="true" />
                <span className="text-[15px] font-semibold text-text-primary">{cat.label}</span>
              </span>
              <span className="relative mt-1 block text-[13px] leading-snug text-text-muted">{cat.description}</span>
              <span className="relative mt-3 flex items-baseline gap-1.5">
                <span className={cn("lamp-numerals text-2xl leading-none", isActive ? "text-primary" : "text-text-primary")}>{count}</span>
                <span className="text-[12px] text-text-dim">{count === 1 ? "event" : "events"}</span>
              </span>
            </TiltPanel>
          );
        })}
      </div>
    </section>
  );
}
