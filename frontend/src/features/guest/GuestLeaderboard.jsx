// Isolated public view: existing data/actions preserved; member source stays unchanged.
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import gsap from "@/lib/gsap-setup";
import { WorldIntro } from "@/components/lamp";
import "./worlds.css";
import { GuestDataHero as MonumentHero } from "./GuestDataHero";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import { leaderboard, events as eventsApi } from "@/lib/api";
// Phase 15 — wrap name mentions with UserHoverCard so any leaderboard
// row reveals Add Friend / Message on hover. Pre-warm the relationship
// store on page load so hovers are instant rather than firing N requests.
import UserHoverCard from "@/components/social/UserHoverCard";
import { useRelationshipStore } from "@/store/relationship-store";

// The way in: a climb through a tower of ranks. Frames fly past in order,
// so the ranks count down the Fibonacci numbers until you reach #1.
const towerBeats = [
  {
    kicker: "Leaderboard",
    title: "Climb the *tower*.",
    body: "Every solved problem is a step up. Weekly ranks reset; lifetime XP never does.",
  },
  {
    kicker: "Every week",
    title: "A fresh climb, every week.",
    body: "When the week closes the weekly ranks start again, so anyone can reach the top next time.",
  },
  {
    kicker: "Hall of Fame",
    title: "The top stays on record.",
    body: "Each week's winner is written into the Hall of Fame for good.",
  },
  {
    kicker: "The standings",
    title: "See who is up *there*.",
    body: "This week, all time, the Hall of Fame and every finished competition.",
  },
];
const towerFrames = ["#89", "#55", "+40 XP", "#34", "#21", "+120 XP", "#13", "#8", "#5", "#3", "#2", "#1"].map(
  (label) => ({ label }),
);
const towerGlyphs = ["↑", "#", "XP", "≥", "max", "Σ", "∞", "1st", "Δ", "n+1", "π", "▲", "∂"];

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
      const comps = (Array.isArray(ev.data) ? ev.data : []).filter(
        (e) =>
          (e.event_type === "competition" || e.event_type === "hackathon") &&
          (e.status === "completed" || e.status === "past"),
      );
      setCompetitionEvents(comps);
      setLoading(false);
    });
  }, []);

  // Fetch event leaderboard when event selected
  useEffect(() => {
    if (!selectedEventId) {
      setEventLb([]);
      return;
    }
    setEventLbLoading(true);
    eventsApi
      .leaderboard(selectedEventId)
      .then((r) => setEventLb(Array.isArray(r.data) ? r.data : []))
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
    useRelationshipStore
      .getState()
      .fetchBatch(ids)
      .catch(() => {});
  }, [current]);

  const rankColors = ["text-warning", "text-text-muted", "text-warning/70"];

  // Podium rise (presentation only): plinths grow out of the floor, third
  // place first and first place last and tallest, and each card rides up
  // on its plinth as the podium scrolls into view.
  const pageRef = useRef(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add({ motion: "(prefers-reduced-motion: no-preference)", wide: "(min-width: 640px)" }, ({ conditions }) => {
        if (!conditions.motion) return;
        const q = gsap.utils.selector(pageRef);
        const podium = q(".mc-podium")[0];
        if (podium) {
          const byRank = (rank) => podium.querySelector(`[data-podium-rank="${rank}"]`);
          const order = [3, 2, 1].map(byRank).filter(Boolean);
          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: { trigger: podium, start: "top 88%", end: "top 30%", scrub: 0.7 },
          });
          order.forEach((place, i) => {
            const step = place.querySelector(".mc-podium-step");
            const card = place.querySelector("[data-podium-card]");
            const at = i * 0.22;
            if (conditions.wide && step) tl.from(step, { scaleY: 0, duration: 0.6 }, at);
            tl.from(
              card,
              {
                y: conditions.wide ? (step?.offsetHeight || 100) + 40 : 60,
                rotateX: -35,
                transformPerspective: 900,
                transformOrigin: "50% 100%",
                duration: 0.6,
              },
              at,
            );
          });
        }
        // The tab row and list tip up into place as they arrive.
        q("[data-rank-list]").forEach((list) => {
          gsap.from(list, {
            rotateX: 14,
            y: 60,
            transformPerspective: 1200,
            transformOrigin: "50% 0%",
            ease: "none",
            scrollTrigger: { trigger: list, start: "top bottom", end: "top 70%", scrub: 0.6 },
          });
        });
        const refresh = gsap.delayedCall(0.9, () => ScrollTrigger.refresh());
        return () => refresh.kill();
      });
      return () => mm.revert();
    },
    { scope: pageRef, dependencies: [loading, eventLbLoading, tab, current.length], revertOnUpdate: true },
  );

  // Pick the correct XP field for the current tab. Uses ?? (nullish
  // coalescing), NOT || — an entry with `xp: 0` has a *real* zero and
  // we must not silently fall through to another field (that's what
  // made the weekly list look mis-ordered: rows with weekly_xp=0 but
  // lifetime xp>0 were showing lifetime XP instead of the 0 they'd
  // been sorted by).
  function xpFor(player) {
    if (tab === "weekly") return player.xp ?? 0; // backend sets xp = weekly_xp here
    if (tab === "alltime") return player.xp ?? 0; // backend sets xp = lifetime xp here
    if (tab === "events") return player.score ?? 0; // event leaderboard shape
    if (tab === "winners") return player.winner_xp ?? 0; // weekly_winners table
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

  return (
    <div style={{ position: "relative" }} ref={pageRef}>
      <WorldIntro
        inset="full"
        className="mc-world"
        beats={towerBeats}
        frames={towerFrames}
        glyphs={towerGlyphs}
        length={4.2}
        cta={
          <Link className="mc-button" to="/register">
            Join the climb
          </Link>
        }
      />
      <div className="relative z-10 space-y-10 pb-16">
        <MonumentHero
          monument="glacier"
          title="Leaderboard"
          subtitle="Rankings"
          description={
            // Backend /api/leaderboard/week-info returns `weekEnd` + `timeLeftStr`.
            // Prefer the pre-formatted human string; otherwise parse weekEnd.
            // Guard against bad/missing dates so we never render "Invalid Date".
            (() => {
              if (!weekInfo) return undefined;
              // timeLeftStr is only a fragment ("3d 4h left") while the week
              // is running; once it expires the backend sends a finished
              // sentence ("Ended 33d ago — reset needed"). Prefixing both
              // rendered "Week resets in Ended 33d ago — reset needed".
              if (weekInfo.timeLeftStr) {
                return weekInfo.expired ? weekInfo.timeLeftStr : `Week resets in ${weekInfo.timeLeftStr}`;
              }
              const end = weekInfo.weekEnd ? new Date(weekInfo.weekEnd) : null;
              if (end && !Number.isNaN(end.getTime())) {
                return `Week resets: ${end.toLocaleDateString()}`;
              }
              return undefined;
            })()
          }
        />

        {/* Two columns on a phone rather than a centred wrap. These
           buttons are skewed parallelograms, so a wrap that centres the
           short second row staggered them against the first and read as
           broken layout. A grid lines them up, and full-width cells give
           a bigger tap target than the content-width chips did. */}
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-center">
          {[
            { key: "weekly", label: "This Week" },
            { key: "alltime", label: "All Time" },
            { key: "winners", label: "Hall of Fame" },
            { key: "events", label: "Events" },
          ].map((t) => (
            <Button key={t.key} variant={tab === t.key ? "primary" : "ghost"} size="sm" onClick={() => setTab(t.key)}>
              {t.label}
            </Button>
          ))}
        </div>

        {/* Event selector for Events tab */}
        {tab === "events" && (
          <div className="mx-auto max-w-md">
            <select
              aria-label="Competition leaderboard"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full rounded-xl border border-line/15 bg-surface/50 px-4 py-3 text-sm text-white outline-none focus:border-primary/30"
            >
              <option value="">— Select a competition —</option>
              {competitionEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
            {competitionEvents.length === 0 && (
              <p className="mt-2 text-center text-xs text-text-dim">No completed competitions yet</p>
            )}
          </div>
        )}

        {loading || (tab === "events" && eventLbLoading) ? (
          <div className="relative z-10 flex justify-center py-20">
            <Loader variant="orbit" size="lg" label="Loading rankings..." />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-full max-w-6xl">
            {/* Top 3 podium */}
            {current.length >= 3 && tab !== "winners" && (
              <div className="mc-podium mx-auto mb-10 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
                {[1, 0, 2].map((idx) => {
                  const p = current[idx];
                  if (!p) return null;
                  const rank = idx + 1;
                  return (
                    <div
                      key={idx}
                      data-podium-rank={rank}
                      className={`text-center ${idx === 0 ? "order-first sm:order-none" : ""}`}
                    >
                      <div data-podium-card>
                        <Card
                          variant={rank === 1 ? "glow" : "glass"}
                          className="text-center"
                          style={{ boxShadow: "0 0 20px var(--page-glow)" }}
                        >
                          <p className={`math-text text-3xl font-bold ${rankColors[rank - 1] || "text-text-dim"}`}>
                            #{rank}
                          </p>
                          <p className="mt-2 text-sm font-medium text-white">
                            {p.user_id ? <UserHoverCard userId={p.user_id}>{nameFor(p)}</UserHoverCard> : nameFor(p)}
                          </p>
                          {subtitleFor(p) && (
                            <p className="font-mono text-[9px] uppercase tracking-wider text-secondary/70">
                              {subtitleFor(p)}
                            </p>
                          )}
                          <p className="math-text mt-1 text-2xl font-bold text-primary">{xpFor(p)}</p>
                          <p className="font-mono text-[10px] text-text-dim">XP</p>
                        </Card>
                      </div>
                      <div className="mc-podium-step" data-rank={rank} aria-hidden="true">
                        {rank}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full list — two columns on wide screens so the ranking
                fills the page instead of a thin centred strip. */}
            <div data-rank-list>
              <Card variant="solid">
                <div className="grid gap-2.5 lg:grid-cols-2 lg:gap-x-4">
                  {current.length === 0 && (
                    <p className="py-8 text-center text-text-dim lg:col-span-2">
                      {tab === "winners"
                        ? "No past winners yet. Weekly winners appear here after each week closes."
                        : tab === "events"
                          ? "Pick a competition above to see its final leaderboard."
                          : "No rankings available yet."}
                    </p>
                  )}
                  {current.map((player, i) => {
                    const href = linkFor(player);
                    const body = (
                      <>
                        <p className={`truncate text-sm font-medium text-white ${href ? "hover:text-primary" : ""}`}>
                          {player.user_id ? (
                            <UserHoverCard userId={player.user_id}>{nameFor(player)}</UserHoverCard>
                          ) : (
                            nameFor(player)
                          )}
                        </p>
                        <p className="truncate font-mono text-[10px] text-text-dim">{subtitleFor(player)}</p>
                      </>
                    );
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.04 }}
                        className="flex items-center gap-4 rounded-xl border border-line/10 bg-black/10 px-4 py-3"
                      >
                        <span
                          className={`math-text flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            i < 3 ? `${rankColors[i]} bg-warning/10` : "bg-white/5 text-text-dim"
                          }`}
                        >
                          {i + 1}
                        </span>
                        {href ? (
                          <Link to={href} className="flex-1 min-w-0 transition hover:opacity-80">
                            {body}
                          </Link>
                        ) : (
                          <div className="flex-1 min-w-0">{body}</div>
                        )}
                        <span className="math-text text-lg font-bold text-primary">{xpFor(player)}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
