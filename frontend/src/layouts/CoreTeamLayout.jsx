/**
 * CoreTeamLayout — shell for the Core Team portal (/core/*).
 *
 * Gates on core-store: a loader while membership resolves, the access
 * gate for outsiders, and the Lamplight AppShell (with the member chip
 * pinned at the top of the rail) for members.
 */
import { useEffect } from "react";
import {
  ArrowLeftRight, CalendarDays, ClipboardList, Lightbulb, LayoutDashboard,
  MessageCircle, MessageSquareText, TrendingUp, Users,
} from "lucide-react";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import LampBackdrop from "@/components/lamp/LampBackdrop";
import { useCoreStore } from "@/store/core-store";
import { useAuthStore } from "@/store/auth-store";
import CoreBadge from "@/features/coreTeam/components/CoreBadge";
import CoreAccessGate from "@/features/coreTeam/components/CoreAccessGate";
import AppShell from "./AppShell";

const GROUPS = [
  { label: "Core team", items: [
    { to: "/core",          label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/core/tasks",    label: "Tasks",     icon: ClipboardList },
    { to: "/core/meetings", label: "Meetings",  icon: CalendarDays },
    { to: "/core/chat",     label: "Chat",      icon: MessageCircle },
  ] },
  { label: "Voice", items: [
    { to: "/core/feedback", label: "Feedback",  icon: MessageSquareText },
    { to: "/core/ideas",    label: "Ideas",     icon: Lightbulb },
    { to: "/core/trends",   label: "Trends",    icon: TrendingUp },
    { to: "/core/roster",   label: "Roster",    icon: Users },
  ] },
  { label: "Elsewhere", items: [{ to: "/dashboard", label: "Student app", icon: ArrowLeftRight }] },
];
const DOCK = GROUPS[0].items;

function MemberChip({ member, teamRank, teamName }) {
  return (
    <div className="lamp-panel lamp-panel--lit p-3.5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(140deg,rgb(var(--violet)),rgb(var(--lamp)))] font-display text-sm font-semibold text-white">
          {(member?.name || "C")[0]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">{member?.name}</p>
          <p className="truncate text-xs text-text-dim">{member?.position} in {teamName}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <CoreBadge tier={member?.tier} />
        <span className="lamp-numerals text-sm text-primary">
          {member?.points ?? 0} <span className="text-xs font-normal text-text-dim">pts</span>
        </span>
      </div>
      {teamRank ? (
        <p className="mt-2 text-xs text-text-dim">Rank {teamRank.rank} of {teamRank.of} in {teamName}</p>
      ) : null}
    </div>
  );
}

export default function CoreTeamLayout() {
  const { status, member, teamRank, fetchMe } = useCoreStore();
  const authUserId = useAuthStore((s) => s.user?.id);

  // Re-resolve core membership whenever the signed-in user changes.
  // CRITICAL on shared computers: the core-store is module-level, so
  // without this the previous person's core profile stays cached and
  // the next user sees the wrong identity. Keying on authUserId forces
  // a fresh /core/me for each user.
  useEffect(() => {
    if (authUserId) fetchMe();
  }, [authUserId, fetchMe]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-obsidian">
        <LampBackdrop />
        <Loader variant="orbit" size="lg" label="Opening the portal…" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 bg-obsidian px-4 text-center">
        <LampBackdrop />
        <p className="relative text-text-muted">The portal couldn&apos;t load right now.</p>
        <Button variant="secondary" size="sm" onClick={fetchMe} className="relative">Retry</Button>
      </div>
    );
  }

  if (status === "outsider") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-obsidian text-text-primary">
        <LampBackdrop />
        <div className="relative z-10">
          <CoreAccessGate />
        </div>
      </div>
    );
  }

  const teamName = member?.core_teams?.name || (member?.tier === "council" ? "Club Council" : "Core Team");

  return (
    <AppShell
      groups={GROUPS}
      dock={DOCK}
      badge="Core"
      homeTo="/core"
      railTop={<MemberChip member={member} teamRank={teamRank} teamName={teamName} />}
    />
  );
}
