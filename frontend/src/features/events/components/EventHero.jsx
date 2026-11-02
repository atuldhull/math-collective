/**
 * EventHero — the "week at a glance" block that opens the events list.
 *
 * Three count-up tiles (upcoming, live, total) and a two-week calendar
 * strip. Each day shows a dot per event on it (live ones pulse); tapping
 * a busy day scrolls to that day's first event card.
 *
 * Motion: the day leaves flip down one after another like a desk
 * calendar as the strip enters, and the rule under them draws itself
 * with the scroll (scrubbed). Reduced motion leaves everything static.
 */
import { useMemo, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { ArrowDown } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import { StatTile } from "@/components/lamp";
import { cn } from "@/lib/cn";

const DAYS = 14;

const DOT = {
  active: "bg-success shadow-[0_0_8px_rgb(var(--color-success))]",
  registering: "bg-primary shadow-[0_0_6px_rgb(var(--lamp)/0.8)]",
  upcoming: "bg-secondary",
};

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function EventHero({ stats = {}, onExplore, events = [] }) {
  const root = useRef(null);

  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const byDay = new Map();
    events.forEach((e) => {
      const when = e.starts_at || e.date;
      if (!when) return;
      const k = dayKey(new Date(when));
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(e);
    });
    return Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { date: d, events: byDay.get(dayKey(d)) || [], today: i === 0 };
    });
  }, [events]);

  const busyDays = days.filter((d) => d.events.length > 0).length;

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-leaf]"), {
        rotateX: -95,
        y: -6,
        autoAlpha: 0,
        transformPerspective: 600,
        transformOrigin: "50% 0%",
        duration: 0.9,
        ease: "back.out(1.6)",
        stagger: 0.045,
        scrollTrigger: { trigger: q("[data-strip]")[0], start: "top 88%", once: true },
      });
      gsap.fromTo(q("[data-strip-rule]"), { scaleX: 0 }, {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { trigger: q("[data-strip]")[0], start: "top 92%", end: "bottom 45%", scrub: 0.8 },
      });
    });
    return () => mm.revert();
  }, { scope: root });

  const scrollToEvent = (id) => {
    document.getElementById(`event-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section ref={root} aria-label="The next two weeks" className="space-y-4">
      <div data-stagger="up" className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile label="Upcoming" value={stats.upcoming || 0} tone="lamp" sub="Open or soon" />
        <StatTile label="Live now" value={stats.live || 0} tone="good" sub={stats.live ? "Right now" : "None running"} />
        <StatTile label="All events" value={stats.total || 0} sub="This season" />
      </div>

      <div data-strip className="lamp-panel p-4 sm:p-5">
        <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg text-text-primary sm:text-xl">The next two weeks</h2>
            <p className="mt-1 text-[13px] text-text-muted">
              {busyDays > 0
                ? `${busyDays} ${busyDays === 1 ? "day has" : "days have"} something on. Tap a day to jump to it.`
                : "Nothing is scheduled yet. New events land here first."}
            </p>
          </div>
          {onExplore ? (
            <Button variant="secondary" size="sm" onClick={onExplore} leading={<ArrowDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}>
              Browse all events
            </Button>
          ) : null}
        </div>

        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <ol className="grid min-w-max auto-cols-[3.6rem] grid-flow-col gap-1.5 sm:auto-cols-[minmax(3.6rem,1fr)] lg:min-w-0">
            {days.map((d, i) => {
              const busy = d.events.length > 0;
              const showMonth = i === 0 || d.date.getDate() === 1;
              const Tag = busy ? "button" : "div";
              return (
                <li key={i} data-leaf>
                  <Tag
                    {...(busy ? { type: "button", onClick: () => scrollToEvent(d.events[0].id) } : {})}
                    aria-label={busy ? `${d.date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}: ${d.events.map((e) => e.title).join(", ")}` : undefined}
                    className={cn(
                      "flex h-full min-h-[5.25rem] w-full flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center transition-colors duration-300",
                      d.today
                        ? "border-primary/45 bg-primary/10 shadow-[0_0_24px_-8px_rgb(var(--lamp)/0.7)]"
                        : busy
                          ? "border-[rgb(var(--rule))] bg-white/[0.035] hover:border-primary/40 hover:bg-primary/[0.06]"
                          : "border-transparent",
                    )}
                  >
                    <span className={cn("text-[11px] font-medium", d.today ? "text-primary" : "text-text-dim")}>
                      {d.today ? "Today" : d.date.toLocaleDateString("en-IN", { weekday: "short" })}
                    </span>
                    <span className={cn("lamp-numerals text-xl leading-none", busy || d.today ? "text-text-primary" : "text-text-dim")}>
                      {d.date.getDate()}
                    </span>
                    <span className="h-3 text-[10px] text-text-dim">
                      {showMonth ? d.date.toLocaleDateString("en-IN", { month: "short" }) : ""}
                    </span>
                    <span className="flex h-2 items-center gap-1" aria-hidden="true">
                      {d.events.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            DOT[e.status] || "bg-text-dim",
                            e.status === "active" && "animate-pulse motion-reduce:animate-none",
                          )}
                        />
                      ))}
                    </span>
                  </Tag>
                </li>
              );
            })}
          </ol>
        </div>

        <div
          data-strip-rule
          aria-hidden="true"
          className="mt-4 h-px origin-left bg-[linear-gradient(90deg,rgb(var(--lamp)/0.7),rgb(var(--rule))_45%,transparent)]"
        />
      </div>
    </section>
  );
}
