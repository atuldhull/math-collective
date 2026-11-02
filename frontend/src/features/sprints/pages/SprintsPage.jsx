/**
 * SprintsPage — /sprints
 *
 * Two-column layout on desktop, stacked on mobile:
 *   • Left:  Active sprint hero (flip-digit countdown + the asymptote
 *            parked at the elapsed fraction of the window) and the
 *            window-scoped leaderboard with a rising podium
 *   • Right: Sprint archive list (last ~6 months)
 *
 * The leaderboard is server-computed per sprint window: writeups
 * posted during the window, scored by upvotes received during the
 * window. Ties broken by who-posted-first (the early-bird wins).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { ArrowBigUp, CalendarRange, History, Trophy } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Loader from "@/components/ui/Loader";
import { PageHeader, AsymptoteCurve, EmptyState } from "@/components/lamp";
import { Flicker, ScrollCount } from "@/components/motion/ScrollFx";
import { sprints as sprintsApi } from "@/lib/api";

export default function SprintsPage() {
  const [params]                  = useSearchParams();
  const slugParam                  = params.get("slug") || null;

  const [archive,    setArchive]   = useState([]);
  const [board,      setBoard]     = useState(null);
  const [boardLoad,  setBoardLoad] = useState(true);
  const [archLoad,   setArchLoad]  = useState(true);
  const [error,      setError]     = useState(null);

  // Fetch archive once. Fast — capped to 26 rows server-side.
  useEffect(() => {
    const ctrl = new AbortController();
    sprintsApi
      .list({ signal: ctrl.signal })
      .then(({ data }) => setArchive(data.data || []))
      .catch((err) => {
        if (err?.code === "ERR_CANCELED") return;
        setError(err?.response?.data?.error || "Couldn't load sprints");
      })
      .finally(() => setArchLoad(false));
    return () => ctrl.abort();
  }, []);

  // Leaderboard for the selected sprint — defaults to active when
  // slug is unset.
  useEffect(() => {
    setBoardLoad(true);
    const ctrl = new AbortController();
    sprintsApi
      .leaderboard(slugParam, { signal: ctrl.signal })
      .then(({ data }) => setBoard(data))
      .catch((err) => {
        if (err?.code === "ERR_CANCELED") return;
        setError(err?.response?.data?.error || "Couldn't load leaderboard");
      })
      .finally(() => setBoardLoad(false));
    return () => ctrl.abort();
  }, [slugParam]);

  const focused = board?.sprint;
  const isActive = focused?.is_active;
  const now = useNow(isActive ? 1000 : null);
  const elapsed = windowFraction(focused, now);
  const totalVotes = (board?.leaderboard || []).reduce((n, r) => n + (Number(r.score) || 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl pb-16">
      <PageHeader
        context="Solution sprints"
        title="One problem. One week. Many takes."
        description="Every Monday a new problem from the catalogue takes the spotlight. Post a writeup during the window to land on this sprint's leaderboard — votes earned during the window are what counts."
        progress={focused ? elapsed : undefined}
      />

      {error && (
        <p className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr] lg:gap-8">
        {/* ── Hero + leaderboard ── */}
        <section className="min-w-0 space-y-6">
          {boardLoad ? (
            <div className="lamp-panel flex justify-center p-10"><Loader variant="orbit" /></div>
          ) : focused ? (
            <>
              <div data-reveal="scale" className="lamp-panel lamp-panel--lit p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={"inline-flex items-center gap-2 text-[13px] font-medium " + (isActive ? "text-primary" : "text-text-muted")}>
                      {isActive && (
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
                          <span className="relative h-2 w-2 rounded-full bg-primary" />
                        </span>
                      )}
                      {isActive ? "Active sprint" : "Archived sprint"}
                    </p>
                    <h2 className="mt-1.5 text-2xl font-semibold leading-tight text-text-primary sm:text-3xl" style={{ textWrap: "balance" }}>
                      {focused.title}
                    </h2>
                  </div>
                  <p className="inline-flex items-center gap-1.5 text-sm text-text-muted">
                    <CalendarRange className="h-4 w-4 text-text-dim" strokeWidth={1.75} />
                    {fmtDate(focused.starts_at)} to {fmtDate(focused.ends_at)}
                  </p>
                </div>

                <div className="mt-6 grid items-end gap-6 sm:grid-cols-[auto,1fr]">
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-text-muted">{isActive ? "Window closes in" : "Window closed"}</p>
                    <FlipCountdown ms={isActive ? new Date(focused.ends_at).getTime() - now : 0} />
                  </div>
                  <div className="min-w-0">
                    <AsymptoteCurve progress={elapsed} className="h-20 w-full" />
                    <p className="mt-1 text-right text-xs tabular-nums text-text-dim">
                      {Math.round(elapsed * 100)}% of the window gone
                    </p>
                  </div>
                </div>
              </div>

              <div data-reveal="fog" data-scroll-range className="lamp-panel p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Flicker as="h3" className="flex items-center gap-2 text-lg font-semibold text-text-primary">
                    <Trophy className="h-5 w-5 text-primary" strokeWidth={1.75} />
                    Window leaderboard
                  </Flicker>
                  {/* Counts up as the board scrolls past. */}
                  {totalVotes > 0 && (
                    <p className="text-[13px] text-text-muted">
                      <ScrollCount value={totalVotes} className="lamp-numerals mr-1 text-lg text-primary" />
                      votes this window
                    </p>
                  )}
                </div>
                <LeaderboardList rows={board?.leaderboard || []} />
              </div>
            </>
          ) : (
            <EmptyState compact title="No sprint to show." body="The next sprint opens on Monday. Pick one from the archive meanwhile." />
          )}
        </section>

        {/* ── Archive ── */}
        <aside className="min-w-0">
          <div className="lamp-panel p-5 lg:sticky lg:top-24">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <History className="h-5 w-5 text-secondary" strokeWidth={1.75} />
              Past sprints
            </h3>
            {archLoad ? (
              <p className="mt-4 text-sm text-text-dim">Loading…</p>
            ) : archive.length === 0 ? (
              <p className="mt-4 text-sm text-text-dim">No archived sprints yet.</p>
            ) : (
              <ul data-stagger="left" className="mt-4 space-y-1.5">
                {archive.map((s) => {
                  const current = slugParam === s.slug || (!slugParam && s.is_active);
                  return (
                    <li key={s.id}>
                      <Link
                        to={`/sprints?slug=${encodeURIComponent(s.slug)}`}
                        aria-current={current ? "page" : undefined}
                        className={
                          "relative block rounded-xl px-3.5 py-2.5 transition " +
                          (current ? "text-text-primary" : "hover:bg-white/[0.04]")
                        }
                      >
                        {current && (
                          <motion.span
                            layoutId="sprint-current"
                            className="absolute inset-0 rounded-xl border border-primary/35 bg-primary/10"
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          />
                        )}
                        <span className="relative block">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-text-primary">{s.title}</span>
                            {s.is_active && <span className="shrink-0 rounded-md bg-primary/15 px-1.5 text-[11px] font-medium text-primary">Live</span>}
                          </span>
                          {s.problem?.title && (
                            <span className="mt-0.5 block truncate text-xs text-text-muted">{s.problem.title}</span>
                          )}
                          <span className="mt-0.5 block text-xs text-text-dim">
                            {fmtDate(s.starts_at)} to {fmtDate(s.ends_at)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

/** Ticks `now` every `interval` ms; null interval = frozen clock. */
function useNow(interval) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!interval) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

function windowFraction(sprint, now) {
  if (!sprint) return 0;
  if (!sprint.is_active) return 1;
  const start = new Date(sprint.starts_at).getTime();
  const end = new Date(sprint.ends_at).getTime();
  if (!(end > start)) return 0;
  // Quantised to whole percent so the curve re-parks ~100 times a
  // week, not every second.
  return Math.round(Math.min(1, Math.max(0, (now - start) / (end - start))) * 100) / 100;
}

/** Days / hours / minutes / seconds as split-flap digit pairs. */
function FlipCountdown({ ms }) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const parts = [
    { label: "days", value: Math.floor(total / 86400) },
    { label: "hrs", value: Math.floor((total % 86400) / 3600) },
    { label: "min", value: Math.floor((total % 3600) / 60) },
    { label: "sec", value: total % 60 },
  ];
  return (
    <div className="flex items-start gap-1.5 sm:gap-2" role="timer" aria-label={`${parts[0].value} days ${parts[1].value} hours ${parts[2].value} minutes left`}>
      {parts.map((p, i) => (
        <div key={p.label} className="flex items-start gap-1.5 sm:gap-2">
          <div className="flex flex-col items-center">
            <div className="flex gap-0.5">
              {String(p.value).padStart(2, "0").split("").map((d, j) => (
                <FlipDigit key={j} digit={d} />
              ))}
            </div>
            <span className="mt-1.5 text-[11px] text-text-dim">{p.label}</span>
          </div>
          {i < parts.length - 1 && <span aria-hidden="true" className="lamp-numerals pt-2 text-xl text-text-dim">:</span>}
        </div>
      ))}
    </div>
  );
}

function FlipDigit({ digit }) {
  return (
    <span
      aria-hidden="true"
      className="relative grid h-12 w-8 place-items-center overflow-hidden rounded-lg border border-[rgb(var(--rule))] bg-obsidian/70 [perspective:400px] sm:h-14 sm:w-10"
    >
      <span className="pointer-events-none absolute inset-x-0 top-1/2 z-[2] h-px bg-black/40" />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={digit}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "50% 50%", backfaceVisibility: "hidden" }}
          className="lamp-numerals block text-2xl text-text-primary sm:text-[1.75rem]"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function LeaderboardList({ rows }) {
  const ranked = useMemo(() => rows.slice(0, 20), [rows]);
  const podiumRef = useRef(null);

  // Podium rises out of the floor, then the winners' names drop in.
  useGSAP(() => {
    if (!podiumRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const q = gsap.utils.selector(podiumRef);
    const tl = gsap.timeline({ scrollTrigger: { trigger: podiumRef.current, start: "top 85%", once: true } });
    tl.from(q("[data-col]"), { scaleY: 0, transformOrigin: "50% 100%", duration: 1.1, ease: "expo.out", stagger: { each: 0.14, from: "center" } })
      .from(q("[data-who]"), { y: -18, autoAlpha: 0, duration: 0.7, ease: "back.out(2)", stagger: 0.1 }, 0.5);
  }, { scope: podiumRef, dependencies: [ranked.length], revertOnUpdate: true });

  if (!ranked.length) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-[rgb(var(--rule))] p-6 text-center text-sm text-text-muted">
        No writeups yet this sprint. Be the first to post one — top of the leaderboard is wide open.
      </div>
    );
  }

  const top = ranked.slice(0, 3);
  // Classic podium order: 2nd, 1st, 3rd.
  const podium = [top[1], top[0], top[2]].map((r, k) => (r ? { r, rank: [2, 1, 3][k] } : null)).filter(Boolean);
  const HEIGHT = { 1: "h-28 sm:h-32", 2: "h-20 sm:h-24", 3: "h-14 sm:h-16" };

  return (
    <>
      <div ref={podiumRef} className="mt-6 grid grid-cols-3 items-end gap-2 sm:gap-3">
        {podium.map(({ r, rank }) => (
          <div key={r.writeup_id} className={"flex min-w-0 flex-col items-center " + (podium.length < 3 && rank === 1 ? "col-start-2" : "")}>
            <div data-who className="mb-2 w-full min-w-0 text-center">
              <p className="truncate text-[13px] font-semibold text-text-primary" title={r.title}>{r.author_name}</p>
              <p className="inline-flex items-center gap-0.5 text-xs tabular-nums text-primary">
                <ArrowBigUp className="h-3.5 w-3.5" strokeWidth={1.75} />{r.score}
              </p>
            </div>
            <div
              data-col
              className={
                "flex w-full items-start justify-center rounded-t-xl border border-b-0 pt-2 " + HEIGHT[rank] + " " +
                (rank === 1
                  ? "border-primary/50 bg-[linear-gradient(rgb(var(--lamp)/0.35),rgb(var(--lamp)/0.05))] shadow-[0_-10px_40px_-12px_rgb(var(--lamp)/0.7)]"
                  : "border-[rgb(var(--rule))] bg-[linear-gradient(rgb(var(--violet)/0.18),transparent)]")
              }
            >
              <span className={"lamp-numerals text-2xl " + (rank === 1 ? "text-primary" : "text-text-muted")}>{rank}</span>
            </div>
          </div>
        ))}
      </div>

      <ol data-stagger="fog" className="space-y-2 border-t border-[rgb(var(--rule))] pt-4">
        {ranked.map((r, i) => (
          <li
            key={r.writeup_id}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.03]"
          >
            <RankBadge rank={i + 1} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{r.title}</p>
              <p className="mt-0.5 truncate text-xs text-text-dim">
                {r.author_handle ? (
                  <Link to={`/u/${r.author_handle}`} className="text-text-muted hover:text-primary">
                    {r.author_name}
                  </Link>
                ) : (
                  <span className="text-text-muted">{r.author_name}</span>
                )}
                <span className="ml-2">posted {fmtDate(r.posted_at)}</span>
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-primary/10 px-2 py-1 text-sm tabular-nums text-primary">
              <ArrowBigUp className="h-4 w-4" strokeWidth={1.75} />
              {r.score}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function RankBadge({ rank }) {
  const tone = rank === 1 ? "bg-primary text-[rgb(var(--color-obsidian))]"
             : rank === 2 ? "bg-secondary/25 text-text-primary"
             : rank === 3 ? "bg-secondary/15 text-text-primary"
             : "bg-white/[0.04] text-text-muted";
  return (
    <span className={"lamp-numerals flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm " + tone}>
      {rank}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
