import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { Building2, DollarSign, Puzzle, Users } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Loader from "@/components/ui/Loader";
import { superAdmin } from "@/lib/api";
import { EmptyState, PageHeader, StatTile } from "@/components/lamp";

export default function SAAnalyticsPage() {
  const root = useRef(null);
  const [analytics, setAnalytics] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      superAdmin.analytics().catch(() => ({ data: null })),
      superAdmin.leaderboard().catch(() => ({ data: [] })),
      superAdmin.auditLogs().catch(() => ({ data: { data: [] } })),
    ]).then(([a, l, au]) => {
      setAnalytics(a.data);
      setLeaderboard(Array.isArray(l.data) ? l.data : []);
      // auditLogs may be { data: [...], total } or just []
      const logs = au.data;
      setAuditLogs(Array.isArray(logs) ? logs : Array.isArray(logs?.data) ? logs.data : []);
      setLoading(false);
    }).catch(() => { setError("Failed to load"); setLoading(false); });
  }, []);

  // Leaderboard XP bars grow from the left; the audit timeline's spine draws down as you scroll.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray("[data-bar]").forEach((el, i) => {
        gsap.from(el, {
          scaleX: 0, transformOrigin: "left center", duration: 1.2, ease: "expo.out", delay: Math.min(i, 10) * 0.04,
          scrollTrigger: { trigger: el, start: "top 96%", once: true },
        });
      });
      const spine = root.current?.querySelector("[data-spine]");
      if (spine) {
        gsap.fromTo(spine, { scaleY: 0 }, {
          scaleY: 1, transformOrigin: "top center", ease: "none",
          scrollTrigger: { trigger: spine, start: "top 85%", end: "bottom 60%", scrub: 0.6 },
        });
      }
    });
  }, { scope: root, dependencies: [loading], revertOnUpdate: true });

  if (loading) return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" label="Loading analytics..." /></div>;
  if (error) return (
    <div className="flex flex-col">
      <PageHeader context="Super admin" title="Platform analytics" size="sm" />
      <EmptyState title={error} body="The analytics service did not answer. Refresh the page to try again." />
    </div>
  );

  const summary = analytics?.summary || {};
  const orgs = analytics?.recentOrgs || [];
  const board = leaderboard.slice(0, 15);
  const maxXp = Math.max(1, ...board.map((u) => u.xp || 0));
  const mrr = Number(summary.mrr);

  return (
    <div ref={root} className="flex flex-col">
      <PageHeader
        context="Super admin"
        title="Platform analytics"
        description="Every organisation on the platform, the strongest students across all of them, and who changed what."
      />

      <div data-stagger="scale" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Organisations" value={summary.totalOrgs ?? 0} icon={Building2} />
        <StatTile label="Total users" value={summary.totalUsers ?? 0} icon={Users} />
        <StatTile label="Challenges" value={summary.totalChallenges ?? 0} icon={Puzzle} />
        <StatTile
          label="MRR"
          value={Number.isFinite(mrr) ? mrr : `${summary.mrr || "0.00"}`}
          prefix="$"
          icon={DollarSign}
          lit
          sub="Monthly recurring revenue"
          tone="lamp"
        />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {/* Orgs breakdown */}
        <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
          <h2 className="text-lg text-text-primary">Recent organisations</h2>
          <ul data-stagger="left" className="mt-4 divide-y divide-[rgb(var(--rule))]">
            {orgs.length === 0 && <li className="py-4 text-center text-[13px] text-text-dim">No organisations</li>}
            {orgs.map((org) => (
              <li key={org.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-primary">{org.name}</p>
                  <p className="truncate text-[12px] text-text-dim"><span className="font-mono">{org.slug}</span>, <span className="capitalize">{org.plan_name || "free"}</span> plan</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${org.status === "active" ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
                  {org.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Global leaderboard */}
        <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
          <h2 className="text-lg text-text-primary">Global leaderboard</h2>
          <ol className="mt-4 max-h-80 space-y-1 overflow-y-auto pr-1">
            {board.length === 0 && <li className="py-4 text-center text-[13px] text-text-dim">No XP earned yet.</li>}
            {board.map((u, i) => (
              <li key={i} className="relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2">
                <span
                  data-bar
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 rounded-xl ${i < 3 ? "bg-primary/[0.1]" : "bg-white/[0.03]"}`}
                  style={{ width: `${Math.max(4, ((u.xp || 0) / maxXp) * 100)}%` }}
                />
                <span className={`lamp-numerals relative w-6 shrink-0 text-center text-sm ${i < 3 ? "text-primary" : "text-text-dim"}`}>{i + 1}</span>
                <span className="relative min-w-0 flex-1 truncate text-sm text-text-primary">{u.name || u.email}</span>
                <span className="lamp-numerals relative shrink-0 text-sm text-primary">{u.xp || 0}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Audit logs */}
      <section data-reveal="up" className="lamp-panel mt-6 p-5 sm:p-6">
        <h2 className="text-lg text-text-primary">Audit log</h2>
        {auditLogs.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-text-dim">No audit logs recorded</p>
        ) : (
          <div className="relative mt-5">
            <span data-spine aria-hidden="true" className="absolute bottom-2 left-[5px] top-2 w-px bg-[linear-gradient(rgb(var(--lamp)/0.6),rgb(var(--rule)))]" />
            <ol data-stagger="left" className="space-y-1">
              {auditLogs.slice(0, 20).map((log, i) => (
                <li key={i} className="relative grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-2 pl-7">
                  <span aria-hidden="true" className="absolute left-0 top-[14px] h-[11px] w-[11px] rounded-full border-2 border-[rgb(var(--color-obsidian))] bg-primary" />
                  <p className="min-w-0 truncate text-sm text-text-primary">{log.action || log.event || "Activity"}</p>
                  <time className="lamp-numerals row-span-2 self-center text-right text-[12px] text-text-dim">{log.created_at ? new Date(log.created_at).toLocaleString() : ""}</time>
                  <p className="min-w-0 truncate text-[12px] text-text-muted">{log.actor || log.user_email || ""}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </div>
  );
}
