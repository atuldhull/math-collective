import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { AlertCircle, BarChart3, Clock, GraduationCap, Lightbulb, Target, Trophy, Users } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { teacher } from "@/lib/api";
import { EmptyState, PageHeader, StatTile } from "@/components/lamp";

const statMeta = [
  { key: "totalStudents", label: "Total students", icon: Users },
  { key: "totalChallenges", label: "Challenges", icon: Lightbulb },
  { key: "totalAttempts", label: "Attempts", icon: BarChart3 },
  { key: "accuracy", label: "Accuracy", icon: Target, suffix: "%" },
];

function getAccuracyColor(accuracy) {
  if (accuracy >= 80) return { bar: "bg-success", text: "text-success" };
  if (accuracy >= 60) return { bar: "bg-primary", text: "text-primary" };
  if (accuracy >= 40) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-danger", text: "text-danger" };
}

function SkeletonLoader() {
  return (
    <div className="space-y-6">
      <div className="h-28 w-2/3 animate-pulse rounded-2xl bg-surface/40" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-[1.25rem] border border-[rgb(var(--rule))] bg-surface/40" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-[1.25rem] border border-[rgb(var(--rule))] bg-surface/40" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-64 animate-pulse rounded-[1.25rem] border border-[rgb(var(--rule))] bg-surface/40 lg:col-span-2" />
        <div className="h-64 animate-pulse rounded-[1.25rem] border border-[rgb(var(--rule))] bg-surface/40" />
      </div>
    </div>
  );
}

const statusTone = {
  correct: "bg-success/10 text-success",
  wrong: "bg-danger/10 text-danger",
};

export default function TeacherDashboardPage() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const perfRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        const [statsRes, activityRes, perfRes] = await Promise.all([
          teacher.stats(),
          teacher.activity(),
          teacher.performance(),
        ]);
        if (cancelled) return;
        setStats(statsRes.data);
        setActivity(Array.isArray(activityRes.data) ? activityRes.data : []);
        setPerformance(Array.isArray(perfRes.data) ? perfRes.data : []);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Failed to load dashboard data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Bespoke moment: each challenge bar is drawn like a ruled line on graph
  // paper — it grows from the left as the panel scrolls in, the percentage
  // ticks up alongside it.
  useGSAP(() => {
    if (!perfRef.current || performance.length === 0) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const bars = perfRef.current.querySelectorAll("[data-bar]");
      const ticks = perfRef.current.querySelectorAll("[data-tick]");
      gsap.fromTo(bars, { scaleX: 0 }, {
        scaleX: 1, transformOrigin: "left center", duration: 1.2, ease: "expo.out", stagger: 0.07,
        scrollTrigger: { trigger: perfRef.current, start: "top 85%", once: true },
      });
      gsap.fromTo(ticks, { scaleY: 0 }, {
        scaleY: 1, transformOrigin: "bottom center", duration: 0.6, ease: "back.out(2)", stagger: 0.03,
        scrollTrigger: { trigger: perfRef.current, start: "top 85%", once: true },
      });
    });
    return () => mm.revert();
  }, { scope: perfRef, dependencies: [performance.length, loading], revertOnUpdate: true });

  const header = (
    <PageHeader
      context="Teacher panel"
      title="Teacher dashboard"
      description="How your students are doing across every challenge, and what they did most recently."
      progress={typeof stats?.accuracy === "number" ? stats.accuracy / 100 : undefined}
    />
  );

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <div>
        {header}
        <div data-reveal="scale" className="lamp-panel flex flex-col items-center gap-4 px-6 py-14 text-center">
          <AlertCircle className="h-10 w-10 text-danger/70" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-sm text-danger">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const engagementRate = stats?.totalStudents
    ? Math.round((stats.totalAttempts / stats.totalStudents) * 10) / 10
    : 0;
  const avgChallengesPerStudent = stats?.totalStudents
    ? Math.round((stats.totalChallenges / stats.totalStudents) * 10) / 10
    : 0;

  const insights = [
    { label: "Attempts per student", value: engagementRate, icon: Users, tone: "text-primary", decimal: true },
    { label: "Challenges per student", value: avgChallengesPerStudent, icon: GraduationCap, tone: "text-secondary", decimal: true },
    { label: "Overall accuracy", value: stats?.accuracy ?? 0, suffix: "%", icon: Trophy, tone: "text-success" },
    { label: "Active students", value: stats?.totalStudents ?? 0, icon: Users, tone: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      {header}

      <div data-stagger="up" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {statMeta.map((meta) => (
          <StatTile
            key={meta.key}
            label={meta.label}
            value={Number(stats?.[meta.key] ?? 0)}
            suffix={meta.suffix || ""}
            icon={meta.icon}
          />
        ))}
      </div>

      <section ref={perfRef} data-reveal="up" className="lamp-panel lamp-panel--lit p-5 sm:p-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-primary">Breakdown</p>
            <h2 className="mt-1 text-xl text-text-primary sm:text-2xl">Challenge performance</h2>
          </div>
          <span className="rounded-full border border-[rgb(var(--rule))] px-3 py-1 text-[13px] text-text-muted">
            {performance.length} challenge{performance.length !== 1 ? "s" : ""}
          </span>
        </div>

        {performance.length === 0 ? (
          <EmptyState
            compact
            className="border-none bg-transparent"
            title="No performance data available yet"
            body="Once students attempt your challenges, accuracy for each one shows up here."
          />
        ) : (
          <div className="space-y-5">
            {performance.map((item, i) => {
              const pct = typeof item.accuracy === "number"
                ? item.accuracy
                : item.total > 0
                  ? Math.round((item.correct / item.total) * 100)
                  : 0;
              const colors = getAccuracyColor(pct);

              return (
                <div key={item.title || i}>
                  <div className="mb-2 flex items-baseline justify-between gap-4">
                    <p className="min-w-0 truncate text-sm text-text-primary" title={item.title}>
                      {item.title}
                    </p>
                    <div className="flex shrink-0 items-baseline gap-3">
                      <span className="text-[12px] tabular-nums text-text-dim">
                        {item.correct}/{item.total}
                      </span>
                      <span className={`lamp-numerals text-base ${colors.text}`}>
                        <AnimatedNumber value={pct} suffix="%" duration={1.2} />
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                    {/* quarter ticks, like the graph paper behind the page */}
                    {[25, 50, 75].map((t) => (
                      <span
                        key={t}
                        data-tick
                        aria-hidden="true"
                        className="absolute inset-y-0 z-[1] w-px bg-[rgb(var(--rule))]"
                        style={{ left: `${t}%` }}
                      />
                    ))}
                    <div
                      data-bar
                      className={`absolute inset-y-0 left-0 rounded-full ${colors.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section data-reveal="up" className="lamp-panel p-5 sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl text-text-primary">Recent activity</h2>
            <Clock className="h-4 w-4 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
          </div>

          {activity.length === 0 ? (
            <EmptyState
              compact
              className="border-none bg-transparent"
              title="No recent activity yet"
              body="Student attempts appear here as they happen."
            />
          ) : (
            <div data-stagger="left" className="scrollbar-thin max-h-[420px] divide-y divide-[rgb(var(--rule))] overflow-y-auto pr-1">
              {activity.map((item, i) => (
                <div
                  key={item._id || item.id || i}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                      {item.studentName?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {item.studentName || "Unknown Student"}
                      </p>
                      <p className="truncate text-[13px] text-text-dim">
                        {item.action || item.description || "Activity"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.status && (
                      <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium capitalize ${statusTone[item.status] || "bg-warning/10 text-warning"}`}>
                        {item.status}
                      </span>
                    )}
                    <span className="whitespace-nowrap text-[12px] tabular-nums text-text-dim">
                      {item.time || item.createdAt ? (
                        <>
                          <span className="hidden sm:inline">
                            {new Date(item.time || item.createdAt).toLocaleString()}
                          </span>
                          <span className="sm:hidden">
                            {new Date(item.time || item.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </>
                      ) : (
                        ""
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section data-reveal="right" className="lamp-panel p-5 sm:p-6">
          <h2 className="text-xl text-text-primary">Engagement</h2>
          <dl data-stagger="up" className="mt-5 divide-y divide-[rgb(var(--rule))]">
            {insights.map(({ label, value, suffix, icon: Icon, tone, decimal }) => (
              <div key={label} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <Icon className={`h-5 w-5 shrink-0 ${tone}`} strokeWidth={1.75} aria-hidden="true" />
                <dt className="flex-1 text-sm text-text-muted">{label}</dt>
                <dd className={`lamp-numerals text-2xl ${tone}`}>
                  {decimal ? `${value}${suffix || ""}` : <AnimatedNumber value={value} suffix={suffix || ""} />}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
