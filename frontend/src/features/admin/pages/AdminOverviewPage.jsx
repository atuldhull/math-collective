import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import {
  CalendarDays, Database, Puzzle, RefreshCw, Settings, Sparkles, Users, FileCheck2, ArrowUpRight,
} from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import { admin, leaderboard } from "@/lib/api";
import UserHoverCard from "@/components/social/UserHoverCard";
import { AsymptoteCurve, EmptyState, PageHeader, StatTile, TiltPanel } from "@/components/lamp";

function weekProgress(info) {
  if (!info?.weekStart || !info?.weekEnd) return undefined;
  const start = new Date(info.weekStart).getTime();
  const end = new Date(info.weekEnd).getTime();
  if (!(end > start)) return undefined;
  return Math.min(1, Math.max(0, (Date.now() - start) / (end - start)));
}

export default function AdminOverviewPage() {
  const root = useRef(null);
  const [stats, setStats] = useState(null);
  const [weekInfo, setWeekInfo] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState(null);

  const renewWeek = async () => {
    if (!confirm("Start a new leaderboard week? Current standings get archived as winners.")) return;
    setResetting(true);
    try {
      const { data } = await admin.resetWeek();
      setResetMsg(data.message || "Week reset — fresh rankings live.");
      const fresh = await leaderboard.weekInfo().catch(() => ({ data: null }));
      setWeekInfo(fresh.data);
      setTimeout(() => setResetMsg(null), 5000);
    } catch (err) {
      setResetMsg(err?.response?.data?.error || "Reset failed — try again.");
      setTimeout(() => setResetMsg(null), 5000);
    }
    setResetting(false);
  };

  useEffect(() => {
    Promise.all([
      admin.stats().catch(() => ({ data: null })),
      leaderboard.weekInfo().catch(() => ({ data: null })),
      admin.activeUsers().catch(() => ({ data: [] })),
    ]).then(([s, w, a]) => {
      setStats(s.data);
      setWeekInfo(w.data);
      setActiveUsers(Array.isArray(a.data) ? a.data : []);
      setLoading(false);
    });
  }, []);

  // XP bars on the top-students ladder grow from zero as they scroll in.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray("[data-bar]").forEach((el, i) => {
        gsap.from(el, {
          scaleX: 0, transformOrigin: "left center", duration: 1.3, ease: "expo.out", delay: i * 0.05,
          scrollTrigger: { trigger: el, start: "top 95%", once: true },
        });
      });
    });
  }, { scope: root, dependencies: [stats], revertOnUpdate: true });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader variant="orbit" size="lg" label="Loading dashboard..." />
      </div>
    );
  }

  const cards = [
    { label: "Total students", value: stats?.totalStudents ?? 0, icon: Users, lit: true },
    { label: "New this week", value: stats?.newStudentsThisWeek ?? 0, icon: Sparkles, tone: "good" },
    { label: "Active challenges", value: stats?.totalChallenges ?? 0, icon: Puzzle },
    { label: "Total submissions", value: stats?.totalAttempts ?? 0, icon: FileCheck2 },
    { label: "Events created", value: stats?.totalEvents ?? 0, icon: CalendarDays },
  ];

  const topStudents = (stats?.topStudents || []).slice(0, 8);
  const maxXp = Math.max(1, ...topStudents.map((s) => s.xp || 0));
  const expired = Boolean(weekInfo?.expired);

  return (
    <div ref={root} className="flex flex-col">
      <PageHeader
        context="Admin"
        title="Club overview"
        description="Who joined, who is online, and where the weekly leaderboard stands."
        progress={weekProgress(weekInfo)}
      />

      {/* Stats */}
      <div data-stagger="scale" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c, i) => (
          <StatTile
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            lit={c.lit}
            className={i === 0 ? "col-span-2 md:col-span-1" : undefined}
          />
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {/* Week countdown */}
        <section
          data-reveal="tilt"
          className={`lamp-panel p-5 sm:p-6 ${expired ? "border-warning/40" : ""}`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg text-text-primary">Leaderboard cycle</h2>
            {expired && (
              <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[12px] font-medium text-warning">
                Expired
              </span>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className={`lamp-numerals text-[2.4rem] leading-none ${expired ? "text-warning" : "text-text-primary"}`}>
                {weekInfo?.timeLeftStr || "—"}
              </p>
              <p className="mt-2 text-[13px] text-text-muted">
                {expired ? "Admin action required" : "until weekly reset"}
              </p>
            </div>
            <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-[13px]">
              <dt className="text-text-dim">Started</dt>
              <dd className="lamp-numerals text-right text-text-muted">{weekInfo?.weekStart ? new Date(weekInfo.weekStart).toLocaleDateString() : "—"}</dd>
              <dt className="text-text-dim">Ends</dt>
              <dd className="lamp-numerals text-right text-text-muted">{weekInfo?.weekEnd ? new Date(weekInfo.weekEnd).toLocaleDateString() : "—"}</dd>
            </dl>
          </div>
          <AsymptoteCurve progress={weekProgress(weekInfo)} className="mt-5 h-12 w-full max-w-sm" />
          {expired && (
            <div className="mt-4 border-t border-[rgb(var(--rule))] pt-4">
              <Button size="sm" variant="primary" loading={resetting} onClick={renewWeek} leading={<RefreshCw className="h-4 w-4" strokeWidth={1.75} />} className="w-full">
                Start new week
              </Button>
            </div>
          )}
          <AnimatePresence>
            {resetMsg && (
              <motion.p
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                className="mt-3 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-[13px] text-success"
              >
                {resetMsg}
              </motion.p>
            )}
          </AnimatePresence>
        </section>

        {/* Live users */}
        <section data-reveal="tilt" className="lamp-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg text-text-primary">Online now</h2>
            <span className="flex items-center gap-2 text-[13px] text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="lamp-numerals">{activeUsers.length}</span> online
            </span>
          </div>
          <ul data-stagger="left" className="mt-4 max-h-56 divide-y divide-[rgb(var(--rule))] overflow-y-auto">
            {activeUsers.length === 0 && <li className="py-4 text-center text-[13px] text-text-dim">Nobody is signed in right now.</li>}
            {activeUsers.slice(0, 10).map((u, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-primary">{u.name || "User"}</p>
                  <p className="truncate font-mono text-[11px] text-text-dim">{u.page || "/"}</p>
                </div>
                <span className="lamp-numerals shrink-0 text-[13px] text-text-muted">{u.sessionDuration ? `${Math.floor(u.sessionDuration / 60)}m` : ""}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Top students */}
        <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
          <h2 className="text-lg text-text-primary">Top students</h2>
          {topStudents.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-text-dim">No XP earned yet.</p>
          ) : (
            <ol data-stagger="left" className="mt-4 space-y-1">
              {topStudents.map((s, i) => (
                <li key={s.id || i} className="relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5">
                  <span
                    data-bar
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 rounded-xl ${i < 3 ? "bg-primary/[0.09]" : "bg-white/[0.03]"}`}
                    style={{ width: `${Math.max(6, ((s.xp || 0) / maxXp) * 100)}%` }}
                  />
                  <span className={`lamp-numerals relative w-6 shrink-0 text-center text-sm ${i < 3 ? "text-primary" : "text-text-dim"}`}>{i + 1}</span>
                  <div className="relative min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">
                      {s.id
                        ? <UserHoverCard userId={s.id}>{s.name || s.email}</UserHoverCard>
                        : (s.name || s.email)}
                    </p>
                    <p className="truncate text-[12px] text-text-dim">{s.title || "Student"}</p>
                  </div>
                  <span className="lamp-numerals relative shrink-0 text-sm text-primary">{s.xp || 0} XP</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Recent activity */}
        <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
          <h2 className="text-lg text-text-primary">Recent activity</h2>
          <ul data-stagger="up" className="mt-4 max-h-72 divide-y divide-[rgb(var(--rule))] overflow-y-auto">
            {(!stats?.recentActivity || stats.recentActivity.length === 0) && <li className="py-4 text-center text-[13px] text-text-dim">No submissions yet.</li>}
            {(stats?.recentActivity || []).slice(0, 12).map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-primary">{a.student_name || a.name || "User"}</p>
                  <p className="truncate text-[12px] text-text-dim">{a.challenge_title || a.action || "Activity"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.is_correct !== undefined && (
                    <span
                      className={`h-2 w-2 rounded-full ${a.is_correct ? "bg-success" : "bg-danger"}`}
                      title={a.is_correct ? "Correct" : "Incorrect"}
                    />
                  )}
                  <span className="lamp-numerals text-[12px] text-text-dim">{a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Quick nav */}
      <nav aria-label="Admin sections" data-stagger="tilt" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { to: "/admin/users", label: "Manage users", icon: Users },
          { to: "/admin/challenges", label: "Challenges", icon: Puzzle },
          { to: "/admin/events", label: "Events", icon: CalendarDays },
          { to: "/admin/data", label: "Data ops", icon: Database },
          { to: "/admin/settings", label: "Settings", icon: Settings },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <TiltPanel
              key={a.to}
              as={Link}
              to={a.to}
              className="group flex min-h-[48px] items-center gap-3 px-4 py-3 text-sm text-text-muted transition-colors hover:text-text-primary"
            >
              <Icon className="relative h-4 w-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
              <span className="relative flex-1">{a.label}</span>
              <ArrowUpRight className="relative h-4 w-4 text-text-dim transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden="true" />
            </TiltPanel>
          );
        })}
      </nav>
      {stats === null && (
        <EmptyState compact className="mt-6" title="Stats did not load" body="The stats service did not answer. Refresh the page to try again." />
      )}
    </div>
  );
}
