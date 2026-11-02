import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Lightbulb, ListChecks, Sparkles, Trophy } from "lucide-react";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { core } from "@/lib/api";
import { useCoreStore } from "@/store/core-store";
import CoreBadge from "@/features/coreTeam/components/CoreBadge";
import CoreMindMap from "@/features/coreTeam/components/CoreMindMap";
import { PageHeader, StatTile, TiltPanel } from "@/components/lamp";

// Nodes for the dashboard mind map — icon path + accent colour each.
// Skin tokens, so every member theme recolours the map; the map mixes
// in transparency with color-mix() rather than hex alpha suffixes.
const MAP_NODES = [
  { to: "/core/tasks",    label: "Tasks",    color: "rgb(var(--lamp))", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { to: "/core/feedback", label: "Feedback", color: "rgb(var(--violet))", icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" },
  { to: "/core/ideas",    label: "Ideas",    color: "rgb(var(--color-success))", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { to: "/core/trends",   label: "Trends",   color: "rgb(var(--color-warning))", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
  { to: "/core/meetings", label: "Meetings", color: "color-mix(in srgb, rgb(var(--violet)) 55%, rgb(var(--lamp)))", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { to: "/core/chat",     label: "Chat",     color: "rgb(var(--color-danger))", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { to: "/core/roster",   label: "Roster",   color: "color-mix(in srgb, rgb(var(--lamp)) 60%, rgb(var(--color-text-primary)))", icon: "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-3-6.93" },
];

export default function CorePortalPage() {
  const { member, teamRank } = useCoreStore();
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      core.tasks().catch(() => ({ data: [] })),
      core.ideas().catch(() => ({ data: { ideas: [] } })),
    ]).then(([t, i]) => {
      setData({
        tasks: Array.isArray(t.data) ? t.data : [],
        ideas: i.data?.ideas || [],
      });
    });
  }, []);

  if (!data) {
    return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" label="Loading…" /></div>;
  }

  const isLead = member?.tier === "council" || member?.tier === "head";
  const myTasks = data.tasks.filter(
    (t) => t.claimer?.id === member?.id && t.status !== "confirmed",
  );
  const openTasks = data.tasks.filter((t) => t.is_open && t.status === "open");
  const pendingConfirm = data.tasks.filter(
    (t) => t.status === "submitted" &&
      (member?.tier === "council" || (member?.tier === "head" && t.team_id === member?.team_id)),
  );
  const myApproved = data.ideas.filter(
    (i) => i.author_member_id === member?.id && i.status === "approved",
  ).length;

  const stats = [
    { label: "My points",      value: member?.points ?? 0,        hint: "earned so far", icon: Sparkles, lit: true },
    { label: "Team rank",      value: teamRank?.rank ?? 0,         hint: teamRank ? `of ${teamRank.of}` : "—", icon: Trophy },
    { label: "Active tasks",   value: myTasks.length,              hint: "in your hands", icon: ListChecks },
    { label: "Ideas approved", value: myApproved,                  hint: "cleared the vote", icon: Lightbulb },
  ];
  const firstName = member?.name?.split(" ")[0] || "Core Member";

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Core team"
        title={`Welcome back, ${firstName}`}
        progress={teamRank?.of ? 1 - (teamRank.rank - 1) / teamRank.of : undefined}
      >
        <div className="flex flex-wrap items-center gap-3">
          <CoreBadge tier={member?.tier} />
          <span className="text-[13px] text-text-muted">
            {member?.position}{member?.position ? ", " : ""}{member?.core_teams?.name || "Club Council"}
          </span>
          {isLead && pendingConfirm.length > 0 && (
            <Link
              to="/core/tasks"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-warning/35 bg-warning/10 px-4 text-sm text-warning transition hover:bg-warning/15"
            >
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" /><span className="relative h-2 w-2 rounded-full bg-warning" /></span>
              <span className="lamp-numerals">{pendingConfirm.length}</span> task{pendingConfirm.length > 1 ? "s" : ""} awaiting your confirmation
            </Link>
          )}
        </div>
      </PageHeader>

      {/* Stats */}
      <div data-stagger="scale" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} sub={s.hint} icon={s.icon} lit={s.lit} tone={s.lit ? "lamp" : "muted"} />
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Portal navigation — animated mind map */}
        <section data-reveal="scale" className="lamp-panel px-4 py-6 sm:px-6">
          <h2 className="text-center text-lg text-text-primary">Navigate the portal</h2>
          <CoreMindMap nodes={MAP_NODES} hubLabel="Core" />
        </section>

        <div className="flex flex-col gap-5">
          {/* Open tasks teaser */}
          <TiltPanel as={Link} to="/core/tasks" data-reveal="tilt" className="group block p-5 sm:p-6">
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl text-text-primary">Up for grabs</h2>
                <p className="mt-2 text-sm leading-6 text-text-muted">
                  {openTasks.length
                    ? `${openTasks.length} open task${openTasks.length > 1 ? "s" : ""} anyone can claim — first come, first serve.`
                    : "No open tasks right now. Check back soon."}
                </p>
              </div>
              <span className="lamp-numerals shrink-0 text-[2.75rem] leading-none text-primary">
                <AnimatedNumber value={openTasks.length} />
              </span>
            </div>
            <span className="relative mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary">
              Go to tasks <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden="true" />
            </span>
          </TiltPanel>

          {/* My active tasks */}
          <section data-reveal="up" className="lamp-panel flex-1 p-5 sm:p-6">
            <h2 className="text-lg text-text-primary">Your active tasks</h2>
            <ul data-stagger="left" className="mt-4 divide-y divide-[rgb(var(--rule))]">
              {myTasks.length === 0 && (
                <li className="py-4 text-center text-sm text-text-dim">
                  Nothing on your plate. Grab a task to start earning points.
                </li>
              )}
              {myTasks.map((t) => (
                <li key={t.id}>
                  <Link to="/core/tasks" className="flex min-h-[48px] items-center justify-between gap-3 py-3 transition-colors hover:text-primary">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text-primary">{t.title}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-text-dim">
                        <span className="capitalize">{t.status.replace("_", " ")}</span>
                        <span className="lamp-numerals text-primary">{t.points} pts</span>
                        {t.deadline ? <span>due <span className="lamp-numerals">{new Date(t.deadline).toLocaleDateString()}</span></span> : null}
                      </p>
                    </div>
                    <span className="shrink-0 text-[13px] text-primary">Open</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
