/**
 * SprintWidget — dashboard sidebar card surfacing the active sprint.
 *
 * Hits /sprints/active once on mount (lazy: many dashboard visits
 * happen in a single browser session so a per-mount fetch is fine
 * without caching). Renders the featured problem title, a countdown
 * to the sprint window's end, current writeup count, and a CTA
 * linking to the problem detail (where the engagement panel +
 * writeup composer live).
 *
 * Failure mode: the active-sprint endpoint can 503 if there are no
 * eligible problems to feature. We surface a quiet "Loading…" skeleton
 * and never show a destructive error — the sprint widget is a nudge,
 * not a critical surface.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Timer } from "lucide-react";
import Card from "@/components/ui/Card";
import { sprints as sprintsApi } from "@/lib/api";

export default function SprintWidget() {
  const [sprint,    setSprint]    = useState(null);
  const [problem,   setProblem]   = useState(null);
  const [count,     setCount]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [hidden,    setHidden]    = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    sprintsApi
      .active({ signal: ctrl.signal })
      .then(({ data }) => {
        setSprint(data.sprint);
        setProblem(data.problem);
        setCount(data.writeup_count || 0);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED") return;
        // 503: no eligible problem. Hide quietly.
        if (err?.response?.status === 503) setHidden(true);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  // Re-render every minute so the countdown stays fresh while the
  // tab is open. Heavyweight intervals would burn battery; one
  // minute is plenty for a weekly window.
  useEffect(() => {
    if (!sprint) return;
    const id = setInterval(() => setTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(id);
  }, [sprint]);

  if (hidden) return null;
  if (loading) {
    return (
      <Card variant="glow">
        <p className="text-[13px] font-medium text-primary">This week&apos;s sprint</p>
        <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" />
      </Card>
    );
  }
  if (!sprint || !problem) return null;

  return (
    <Card variant="glow">
      <div className="flex items-center justify-between">
        <p className="inline-flex items-center gap-2 text-[13px] font-medium text-primary">
          <Timer className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> This week&apos;s sprint
        </p>
        <Link to="/sprints" className="text-[13px] text-text-muted transition hover:text-primary">
          View all
        </Link>
      </div>
      <div className="mt-4">
        <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-text-primary">{problem.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs capitalize text-text-dim">
          {problem.source && (
            <span className="rounded-full border border-[rgb(var(--rule))] px-2 py-0.5">
              {problem.source}
            </span>
          )}
          {problem.difficulty && (
            <span className="rounded-full border border-[rgb(var(--rule))] px-2 py-0.5">
              {problem.difficulty}
            </span>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-[13px]">
          <span className="text-text-muted">
            {count} writeup{count === 1 ? "" : "s"} so far
          </span>
          <Countdown endsAt={sprint.ends_at} />
        </div>
        <Link
          to={`/problems/${problem.slug || problem.id}`}
          className="mt-4 block rounded-xl bg-primary px-3 py-2.5 text-center text-sm font-semibold text-[rgb(var(--color-obsidian))] shadow-[0_10px_30px_-12px_rgb(var(--lamp)/0.75)] transition hover:brightness-110"
        >
          Join the sprint
        </Link>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────── */

function Countdown({ endsAt }) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return <span className="text-text-dim">Closing now</span>;
  const totalMins = Math.floor(ms / (60 * 1000));
  const days = Math.floor(totalMins / (24 * 60));
  const hours = Math.floor((totalMins % (24 * 60)) / 60);
  const mins = totalMins % 60;

  let label;
  if (days > 0) label = `${days}d ${hours}h left`;
  else if (hours > 0) label = `${hours}h ${mins}m left`;
  else label = `${mins}m left`;

  return <span className="lamp-numerals text-primary">{label}</span>;
}
