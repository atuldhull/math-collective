import { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { Check, X, Zap, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import gsap from "@/lib/gsap-setup";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/cn";
import { PageHeader, TiltPanel, StatTile, EmptyState } from "@/components/lamp";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { arena } from "@/lib/api";

const RING = 2 * Math.PI * 42;

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "---";
}

export default function TestHistoryPage() {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const root = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const [histRes, statsRes] = await Promise.all([
        arena.history(),
        arena.stats(),
      ]);
      setHistory(histRes.data);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  const totalAttempts = stats?.totalAttempts ?? history.length;
  const correctCount = stats?.correct ?? history.filter((h) => h.correct).length;
  const incorrectCount = stats?.incorrect ?? totalAttempts - correctCount;
  const accuracy =
    totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
  const totalXP = stats?.totalXp ?? history.reduce((sum, h) => sum + (h.xpEarned || 0), 0);
  const maxXP = Math.max(1, ...history.map((h) => h.xpEarned || 0));

  // Bespoke moments: the accuracy ring draws itself and its two bars
  // fill when the panel scrolls in; every history row's XP bar fills
  // as its batch of rows arrives on screen.
  useGSAP(() => {
    if (!root.current) return undefined;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const ring = q("[data-ring]");
      if (ring.length) {
        gsap.timeline({ scrollTrigger: { trigger: q("[data-accuracy]")[0], start: "top 85%", once: true } })
          .from(ring, { strokeDashoffset: RING, duration: 1.6, ease: "expo.out" })
          .from(q("[data-split-bar]"), { scaleX: 0, transformOrigin: "left center", duration: 1.1, ease: "expo.out", stagger: 0.12 }, 0.2);
      }
      const bars = q("[data-bar]");
      if (bars.length) {
        gsap.set(bars, { scaleX: 0, transformOrigin: "left center" });
        ScrollTrigger.batch(bars, {
          start: "top 92%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { scaleX: 1, duration: 1, ease: "expo.out", stagger: 0.05 }),
        });
      }
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [loading, history.length], revertOnUpdate: true });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader variant="orbit" size="lg" label="Loading history..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-danger">{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div ref={root} className="space-y-8 pb-16">
      <PageHeader
        context="Arena record"
        title="Test history"
        description="Your complete record of arena challenges and quiz attempts."
        progress={accuracy / 100}
      />

      <section data-stagger="up" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Total attempts" value={totalAttempts} icon={ListChecks} />
        <StatTile label="Correct" value={correctCount} icon={Check} tone="good" sub={`${accuracy}% of attempts`} />
        <StatTile label="Incorrect" value={incorrectCount} icon={X} tone="bad" />
        <StatTile label="Total XP" value={totalXP} icon={Zap} tone="lamp" />
      </section>

      <TiltPanel lit tilt={false} data-reveal="up" data-accuracy className="p-6 sm:p-8">
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
          <div className="relative mx-auto flex h-36 w-36 flex-shrink-0 items-center justify-center sm:mx-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--rule))" strokeWidth="7" />
              <circle
                data-ring
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="rgb(var(--lamp))"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - accuracy / 100)}
                style={{ filter: "drop-shadow(0 0 6px rgb(var(--lamp)/0.55))" }}
              />
            </svg>
            <span className="lamp-numerals absolute text-3xl text-text-primary">
              <AnimatedNumber value={accuracy} suffix="%" duration={1.6} />
            </span>
          </div>
          <div className="flex-1 space-y-5">
            <div>
              <h2 className="text-2xl text-text-primary">Accuracy overview</h2>
              <p className="mt-1 text-sm text-text-muted">How your answers have landed across every attempt.</p>
            </div>
            {[
              { label: "Correct", value: correctCount, bar: "bg-success", text: "text-success" },
              { label: "Incorrect", value: incorrectCount, bar: "bg-danger", text: "text-danger" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">{row.label}</span>
                  <span className={cn("lamp-numerals", row.text)}>{row.value}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[rgb(var(--rule))]">
                  <div
                    data-split-bar
                    className={cn("h-full rounded-full", row.bar)}
                    style={{ width: totalAttempts > 0 ? `${(row.value / totalAttempts) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </TiltPanel>

      <section className="space-y-4">
        <div data-reveal="fade" className="flex items-end justify-between gap-4">
          <h2 className="text-2xl text-text-primary">All attempts</h2>
          {history.length > 0 ? <p className="text-sm text-text-dim">{history.length} recorded</p> : null}
        </div>

        {history.length === 0 ? (
          <EmptyState
            title="No attempts recorded yet"
            body="Head to the arena and solve your first challenge. Every attempt is logged here."
            action={<Link to="/arena"><Button>Open the arena</Button></Link>}
          />
        ) : (
          <div className="lamp-panel overflow-hidden">
            {/* Column labels, desktop only. Phones get stacked rows. */}
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_7rem_minmax(0,1.3fr)_7rem] gap-4 border-b border-[rgb(var(--rule))] px-5 py-3 text-[13px] font-medium text-text-dim sm:grid">
              <span>Challenge</span>
              <span>Your answer</span>
              <span>Result</span>
              <span>XP</span>
              <span>Date</span>
            </div>
            <ul data-stagger="fade" className="divide-y divide-[rgb(var(--rule))]">
              {history.map((attempt, i) => {
                const xp = attempt.xpEarned || 0;
                return (
                  <li
                    key={attempt._id || i}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 px-4 py-4 transition-colors duration-300 hover:bg-[rgb(var(--lamp)/0.04)] sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_7rem_minmax(0,1.3fr)_7rem] sm:items-center sm:px-5"
                  >
                    <p className="min-w-0 text-sm font-medium text-text-primary">
                      {attempt.challengeTitle || attempt.challengeName || "Challenge"}
                    </p>
                    <p className="hidden truncate font-mono text-xs text-text-muted sm:block">
                      {attempt.selectedAnswer ?? attempt.selectedIndex ?? "---"}
                    </p>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1 justify-self-end rounded-full border px-2.5 py-0.5 text-[12px] font-medium sm:justify-self-start",
                        attempt.correct
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-danger/30 bg-danger/10 text-danger",
                      )}
                    >
                      {attempt.correct ? <Check className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" /> : <X className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />}
                      {attempt.correct ? "Correct" : "Wrong"}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgb(var(--rule))]">
                        <div
                          data-bar
                          className={cn("h-full rounded-full", xp > 0 ? "bg-primary" : "bg-transparent")}
                          style={{ width: `${(xp / maxXP) * 100}%` }}
                        />
                      </div>
                      <span className={cn("lamp-numerals w-12 shrink-0 text-right text-sm", xp > 0 ? "text-primary" : "text-text-dim")}>
                        {xp > 0 ? `+${xp}` : "0"}
                      </span>
                    </div>
                    <span className="justify-self-end text-xs text-text-dim sm:justify-self-start">
                      {formatDate(attempt.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
