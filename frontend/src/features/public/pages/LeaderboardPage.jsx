import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { Crown } from "lucide-react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { EmptyState, PageHeader, SegmentedTabs } from "@/components/lamp";
import { ScrollCount } from "@/components/motion/ScrollFx";
import { leaderboard, events as eventsApi } from "@/lib/api";
// Phase 15 — wrap name mentions with UserHoverCard so any leaderboard
// row reveals Add Friend / Message on hover. Pre-warm the relationship
// store on page load so hovers are instant rather than firing N requests.
import UserHoverCard from "@/components/social/UserHoverCard";
import { useRelationshipStore } from "@/store/relationship-store";

// jsdom has no matchMedia; treat "can't tell" as "don't animate".
const motionOK = () =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

const TABS = [
  { value: "weekly", label: "This week" },
  { value: "alltime", label: "All time" },
  { value: "winners", label: "Hall of fame" },
  { value: "events", label: "Events" },
];

// Tone per podium place: the lamp for first, violet for second, chalk for third.
const PLACE = {
  1: {
    block: "h-36 sm:h-52 border-[rgb(var(--lamp)/0.55)] bg-[linear-gradient(180deg,rgb(var(--lamp)/0.24),rgb(var(--lamp)/0.04)_75%,transparent)] shadow-[0_-20px_60px_-20px_rgb(var(--lamp)/0.6)]",
    numeral: "text-primary [text-shadow:0_0_28px_rgb(var(--lamp)/0.7)]",
    xp: "text-primary",
  },
  2: {
    block: "h-24 sm:h-36 border-[rgb(var(--violet)/0.45)] bg-[linear-gradient(180deg,rgb(var(--violet)/0.2),rgb(var(--violet)/0.03)_75%,transparent)]",
    numeral: "text-secondary",
    xp: "text-text-primary",
  },
  3: {
    block: "h-16 sm:h-28 border-[rgb(var(--rule))] bg-[linear-gradient(180deg,rgb(var(--color-text-primary)/0.07),transparent_80%)]",
    numeral: "text-text-muted",
    xp: "text-text-primary",
  },
};

const ROW_RANK = ["text-primary bg-primary/12", "text-secondary bg-secondary/12", "text-text-primary bg-white/[0.07]"];

export default function LeaderboardPage() {
  const [tab, setTab] = useState("weekly");
  const [weekly, setWeekly] = useState([]);
  const [allTime, setAllTime] = useState([]);
  const [winners, setWinners] = useState([]);
  const [weekInfo, setWeekInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Event leaderboard state
  const [competitionEvents, setCompetitionEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventLb, setEventLb] = useState([]);
  const [eventLbLoading, setEventLbLoading] = useState(false);

  const listRef = useRef(null);

  useEffect(() => {
    Promise.all([
      leaderboard.weekly().catch(() => ({ data: [] })),
      leaderboard.allTime().catch(() => ({ data: [] })),
      leaderboard.winners().catch(() => ({ data: [] })),
      leaderboard.weekInfo().catch(() => ({ data: null })),
      eventsApi.list().catch(() => ({ data: [] })),
    ]).then(([w, a, win, info, ev]) => {
      setWeekly(Array.isArray(w.data) ? w.data : []);
      setAllTime(Array.isArray(a.data) ? a.data : []);
      setWinners(Array.isArray(win.data) ? win.data : []);
      setWeekInfo(info.data);
      // Only show competition/hackathon events that have ended
      const comps = (Array.isArray(ev.data) ? ev.data : [])
        .filter(e => (e.event_type === "competition" || e.event_type === "hackathon") && (e.status === "completed" || e.status === "past"));
      setCompetitionEvents(comps);
      setLoading(false);
    });
  }, []);

  // Fetch event leaderboard when event selected
  useEffect(() => {
    if (!selectedEventId) { setEventLb([]); return; }
    setEventLbLoading(true);
    eventsApi.leaderboard(selectedEventId)
      .then(r => setEventLb(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEventLb([]))
      .finally(() => setEventLbLoading(false));
  }, [selectedEventId]);

  const current = tab === "weekly" ? weekly : tab === "alltime" ? allTime : tab === "events" ? eventLb : winners;

  // Phase 15 — pre-warm the relationship store with every user_id
  // visible in the current tab, in a single batched request. Without
  // this, hovering each row would fire its own GET and the first hover
  // on a freshly-rendered list feels slow. With this, the cache is
  // already populated by the time the user moves their cursor.
  useEffect(() => {
    const ids = current.map((p) => p.user_id).filter(Boolean);
    if (ids.length === 0) return;
    useRelationshipStore.getState().fetchBatch(ids).catch(() => {});
  }, [current]);

  // Pick the correct XP field for the current tab. Uses ?? (nullish
  // coalescing), NOT || — an entry with `xp: 0` has a *real* zero and
  // we must not silently fall through to another field (that's what
  // made the weekly list look mis-ordered: rows with weekly_xp=0 but
  // lifetime xp>0 were showing lifetime XP instead of the 0 they'd
  // been sorted by).
  function xpFor(player) {
    if (tab === "weekly")  return player.xp         ?? 0; // backend sets xp = weekly_xp here
    if (tab === "alltime") return player.xp         ?? 0; // backend sets xp = lifetime xp here
    if (tab === "events")  return player.score      ?? 0; // event leaderboard shape
    if (tab === "winners") return player.winner_xp  ?? 0; // weekly_winners table
    return player.xp ?? player.total_xp ?? player.score ?? 0;
  }

  // The Hall of Fame uses the weekly_winners table which has a different
  // schema (winner_name, winner_email, winner_xp, week_start, week_end)
  // — not a live student row. Pull display fields tab-aware.
  function nameFor(player) {
    if (tab === "winners") return player.winner_name || "Anonymous";
    return player.name || player.student_name || "Member";
  }
  function subtitleFor(player) {
    if (tab === "winners") {
      const start = player.week_start ? new Date(player.week_start) : null;
      if (start && !Number.isNaN(start.getTime())) {
        return `Week of ${start.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}`;
      }
      return "Weekly winner";
    }
    return player.title || player.email || "";
  }

  // Profile-link target. Winners rows don't carry a user_id, so render a
  // non-clickable wrapper for those.
  function linkFor(player) {
    // Phase 15: point at the rich /profile/:userId route directly. The
    // /student/:userId redirect still works for any external/old links.
    if (tab !== "winners" && player.user_id) return `/profile/${player.user_id}`;
    return null;
  }

  // Backend /api/leaderboard/week-info returns `weekEnd` + `timeLeftStr`.
  // Prefer the pre-formatted human string; otherwise parse weekEnd.
  // Guard against bad/missing dates so we never render "Invalid Date".
  const weekLine = (() => {
    if (!weekInfo) return undefined;
    // timeLeftStr is only a fragment ("3d 4h left") while the week
    // is running; once it expires the backend sends a finished
    // sentence ("Ended 33d ago — reset needed"). Prefixing both
    // rendered "Week resets in Ended 33d ago — reset needed".
    if (weekInfo.timeLeftStr) {
      return weekInfo.expired
        ? weekInfo.timeLeftStr
        : `Week resets in ${weekInfo.timeLeftStr}`;
    }
    const end = weekInfo.weekEnd ? new Date(weekInfo.weekEnd) : null;
    if (end && !Number.isNaN(end.getTime())) {
      return `Week resets: ${end.toLocaleDateString()}`;
    }
    return undefined;
  })();

  const busy = loading || (tab === "events" && eventLbLoading);
  const topXp = Math.max(1, ...current.map((p) => Number(xpFor(p)) || 0));

  // Each row carries a thin bar of its XP against the leader's. The bars
  // fill from the left as their rows scroll into view.
  useGSAP(() => {
    if (busy || !listRef.current || !motionOK()) return;
    const bars = gsap.utils.toArray("[data-bar]", listRef.current);
    if (!bars.length) return;
    gsap.set(bars, { scaleX: 0, transformOrigin: "left center" });
    ScrollTrigger.batch(bars, {
      start: "top 92%",
      once: true,
      onEnter: (batch) => gsap.to(batch, { scaleX: 1, duration: 1.3, ease: "expo.out", stagger: 0.05, delay: 0.25 }),
    });
  }, { scope: listRef, dependencies: [busy, tab, current], revertOnUpdate: true });

  const tabs = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <SegmentedTabs items={TABS} value={tab} onChange={setTab} aria-label="Leaderboard view" />
      {tab === "events" ? (
        <div className="w-full sm:max-w-xs">
          <label htmlFor="lb-event" className="sr-only">Competition</label>
          <select
            id="lb-event"
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            className="h-11 w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-4 text-sm text-text-primary outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Choose a competition</option>
            {competitionEvents.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
          {competitionEvents.length === 0 && (
            <p className="mt-2 text-[13px] text-text-dim">No completed competitions yet.</p>
          )}
        </div>
      ) : weekLine && tab === "weekly" ? (
        <p className="text-[13px] font-medium text-text-muted">{weekLine}</p>
      ) : null}
    </div>
  );

  const emptyTitle = tab === "winners"
    ? "No past winners yet"
    : tab === "events"
      ? "Pick a competition"
      : "No rankings yet";
  const emptyBody = tab === "winners"
    ? "Weekly winners appear here after each week closes."
    : tab === "events"
      ? "Pick a competition above to see its final leaderboard."
      : "Solve a challenge to put the first name on the board.";

  return (
    <>
      <PageHeader
        context="Rankings"
        title="Leaderboard"
        description={weekLine || "Who solved the most this week, this year and ever."}
      >
        {tabs}
      </PageHeader>

      <div className="relative z-10 space-y-10 pb-16">

        {busy ? (
          <div className="flex justify-center py-20">
            <Loader variant="orbit" size="lg" label="Loading rankings..." />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-6xl">
            {/* Top 3 podium. Keyed by tab so it rises again on every switch. */}
            {current.length >= 3 && tab !== "winners" && (
              <Podium
                key={`${tab}-${selectedEventId}`}
                top={current.slice(0, 3)}
                nameFor={nameFor}
                subtitleFor={subtitleFor}
                xpFor={xpFor}
              />
            )}

            {current.length === 0 ? (
              <EmptyState compact title={emptyTitle} body={emptyBody} />
            ) : (
              <div ref={listRef} data-scroll-range>
                {/* Sticks under the top bar; the count climbs as the ranking scrolls past. */}
                <div className="sticky top-[4.5rem] z-20 mb-4 flex items-baseline justify-between gap-3 rounded-xl bg-[rgb(var(--color-obsidian)/0.72)] px-1 py-2 backdrop-blur-md">
                  <h2 className="text-xl text-text-primary sm:text-2xl">Full ranking</h2>
                  <p className="text-[13px] text-text-dim">
                    <ScrollCount value={current.length} start="top 75%" end="bottom 80%" className="lamp-numerals mr-1 text-base text-primary" />
                    {current.length === 1 ? "climber" : "climbers"}
                  </p>
                </div>
                {/* Two columns on wide screens so the ranking fills the
                    page instead of a thin centred strip. */}
                <ol data-stagger="fog" className="grid gap-2.5 lg:grid-cols-2 lg:gap-x-4">
                  {current.map((player, i) => {
                    const href = linkFor(player);
                    const xp = xpFor(player);
                    const body = (
                      <>
                        <p className={cn("truncate text-[15px] font-medium text-text-primary", href && "transition-colors group-hover:text-primary")}>
                          {player.user_id ? (
                            <UserHoverCard userId={player.user_id}>{nameFor(player)}</UserHoverCard>
                          ) : nameFor(player)}
                        </p>
                        {subtitleFor(player) ? (
                          <p className="truncate text-[13px] text-text-dim">{subtitleFor(player)}</p>
                        ) : null}
                      </>
                    );
                    return (
                      <li
                        key={i}
                        className={cn(
                          "group relative flex items-center gap-3 overflow-hidden rounded-xl border bg-surface/55 px-3 py-3 backdrop-blur-sm transition-colors sm:gap-4 sm:px-4",
                          i === 0 ? "border-[rgb(var(--lamp)/0.35)]" : "border-[rgb(var(--rule))] hover:border-[rgb(var(--lamp)/0.3)]",
                        )}
                      >
                        <span className={cn(
                          "lamp-numerals flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[15px]",
                          ROW_RANK[i] || "bg-white/[0.04] text-text-dim",
                        )}>
                          {i + 1}
                        </span>
                        {href ? (
                          <Link to={href} className="min-w-0 flex-1">
                            {body}
                          </Link>
                        ) : (
                          <div className="min-w-0 flex-1">{body}</div>
                        )}
                        <span className="lamp-numerals shrink-0 text-lg text-primary">
                          {xp}
                          <span className="ml-1 text-[12px] font-medium text-text-dim">XP</span>
                        </span>
                        {/* XP relative to the leader */}
                        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-transparent">
                          <span
                            data-bar
                            className={cn("block h-full", i === 0 ? "bg-primary shadow-[0_0_10px_rgb(var(--lamp)/0.8)]" : "bg-[rgb(var(--lamp)/0.45)]")}
                            style={{ width: `${Math.max(2, Math.min(100, ((Number(xp) || 0) / topXp) * 100))}%` }}
                          />
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Podium — the top three, standing on blocks that rise out of the floor:
 * third, then second, then first. Each name drops onto its block as it
 * lands and the crown settles on the winner last.
 */
function Podium({ top, nameFor, subtitleFor, xpFor }) {
  const root = useRef(null);

  useGSAP(() => {
    if (!motionOK()) return;
    const q = gsap.utils.selector(root);
    const tl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.15 });
    tl.from(q("[data-floor]"), { scaleX: 0, duration: 1.1 }, 0);
    [3, 2, 1].forEach((rank, i) => {
      const at = 0.15 + i * 0.22;
      tl.from(q(`[data-rank="${rank}"] [data-pod-block]`), { scaleY: 0, transformOrigin: "50% 100%", duration: 1.15 }, at)
        .from(q(`[data-rank="${rank}"] [data-pod-numeral]`), { yPercent: 80, autoAlpha: 0, duration: 0.9 }, at + 0.3)
        .from(q(`[data-rank="${rank}"] [data-pod-head]`), { y: -46, autoAlpha: 0, duration: 0.9, ease: "back.out(1.7)" }, at + 0.45);
    });
    tl.from(q("[data-crown]"), { y: -40, rotate: -35, scale: 0.4, autoAlpha: 0, duration: 1.1, ease: "elastic.out(1, 0.5)" }, ">-0.35")
      .from(q("[data-beam]"), { autoAlpha: 0, scaleY: 0.2, transformOrigin: "50% 100%", duration: 1.4, ease: "power2.out" }, "<");
    gsap.to(q("[data-crown]"), { y: -5, rotate: 4, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2.4 });
  }, { scope: root });

  return (
    <section ref={root} aria-label="Top three" className="relative mx-auto mb-14 max-w-4xl">
      {/* light falling on the winner */}
      <div
        data-beam
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-[120%] w-1/3 -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_100%,rgb(var(--lamp)/0.2),transparent_65%)]"
      />
      <div className="relative grid grid-cols-3 items-end gap-2 sm:gap-5">
        {[1, 0, 2].map((idx) => {
          const p = top[idx];
          if (!p) return null;
          const rank = idx + 1;
          const tone = PLACE[rank];
          const sub = subtitleFor(p);
          return (
            <div key={idx} data-rank={rank} className="flex min-w-0 flex-col items-center">
              <div data-pod-head className="mb-3 flex w-full min-w-0 flex-col items-center px-1 text-center">
                {rank === 1 ? (
                  <Crown data-crown className="mb-1.5 h-6 w-6 text-primary drop-shadow-[0_0_10px_rgb(var(--lamp)/0.8)] sm:h-7 sm:w-7" strokeWidth={1.75} aria-hidden="true" />
                ) : null}
                <p className={cn("w-full truncate font-medium text-text-primary", rank === 1 ? "text-[15px] sm:text-lg" : "text-[13px] sm:text-base")}>
                  {p.user_id ? (
                    <UserHoverCard userId={p.user_id}>{nameFor(p)}</UserHoverCard>
                  ) : nameFor(p)}
                </p>
                {sub ? <p className="hidden w-full truncate text-[13px] text-text-dim sm:block">{sub}</p> : null}
                <p className={cn("lamp-numerals mt-1 leading-none", tone.xp, rank === 1 ? "text-2xl sm:text-3xl" : "text-lg sm:text-2xl")}>
                  <AnimatedNumber value={Number(xpFor(p)) || 0} duration={1.8} />
                  <span className="ml-1 text-[12px] font-medium text-text-dim">XP</span>
                </p>
              </div>
              <div
                data-pod-block
                className={cn("relative flex w-full justify-center overflow-hidden rounded-t-2xl border border-b-0 pt-3", tone.block)}
              >
                <span data-pod-numeral className={cn("lamp-numerals block leading-none", tone.numeral, rank === 1 ? "text-5xl sm:text-7xl" : "text-4xl sm:text-6xl")}>
                  {rank}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div data-floor aria-hidden="true" className="h-px w-full origin-center bg-[linear-gradient(90deg,transparent,rgb(var(--lamp)/0.6),transparent)]" />
    </section>
  );
}
