import {
  Award, BadgeCheck, BarChart3, Bookmark, Building2, CalendarDays, CreditCard,
  Database, FileBadge, FolderKanban, Gift, History, Home, Images, KeyRound,
  LayoutDashboard, Lightbulb, Mail, Map, PlayCircle, Puzzle, Radio, ScanLine,
  Settings, ShieldCheck, Swords, Timer, ToggleRight, Trophy, UserPlus, Users,
} from "lucide-react";

export const mainNavigation = [
  { to: "/", label: "Home", note: "System overview" },
  { to: "/arena", label: "Arena", note: "Challenge zone" },
  { to: "/leaderboard", label: "Leaderboard", note: "Rankings" },
  { to: "/events", label: "Events", note: "Competitions" },
  { to: "/gallery", label: "Gallery", note: "Photos" },
];

export const studentNavigation = [
  { to: "/dashboard", label: "Dashboard", note: "My stats" },
  { to: "/arena", label: "Arena", note: "Solve challenges" },
  { to: "/live-quiz", label: "Live Quiz", note: "Join a quiz" },
  { to: "/projects", label: "Projects", note: "Team work" },
  { to: "/certificates", label: "Certificates", note: "My certs" },
  { to: "/notifications", label: "Notifications", note: "Updates" },
];

export const teacherNavigation = [
  { to: "/teacher", label: "Dashboard", note: "Overview" },
  { to: "/teacher/students", label: "Students", note: "Student list" },
  { to: "/teacher/challenges", label: "Challenges", note: "Question bank" },
  { to: "/teacher/certificates", label: "Certificates", note: "Generate certs" },
  { to: "/teacher/quiz", label: "Quiz", note: "Live quiz" },
];

export const adminNavigation = [
  { to: "/admin", label: "Overview", note: "Mission control" },
  { to: "/admin/users", label: "Users", note: "User management" },
  { to: "/admin/recruitment", label: "Recruitment", note: "Registration intake" },
  { to: "/admin/challenges", label: "Challenges", note: "Question ops" },
  { to: "/admin/events", label: "Events", note: "Event management" },
  { to: "/admin/moderation", label: "Moderation", note: "Roadmaps + problem submissions" },
  { to: "/admin/data", label: "Data Ops", note: "Data management" },
  { to: "/admin/features", label: "Features", note: "Feature flags + plan" },
  { to: "/admin/settings", label: "Settings", note: "System config" },
];

export const superAdminNavigation = [
  { to: "/super-admin", label: "Analytics", note: "Platform stats" },
  { to: "/super-admin/organisations", label: "Organisations", note: "Org management" },
  { to: "/super-admin/plans", label: "Plans & Billing", note: "Subscriptions" },
  { to: "/super-admin/access", label: "Access Control", note: "Impersonation & flags" },
];

// ── Lamplight shell navigation ─────────────────────────────────────
// Grouped rail sections (desktop) + the four phone-dock shortcuts per
// audience. Icons are lucide components so the rail, dock and More
// sheet all draw from one source.

export const studentRail = [
  { label: "Practice", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/arena", label: "Arena", icon: Swords },
    { to: "/problems", label: "Problems", icon: Puzzle },
    { to: "/roadmaps", label: "Roadmaps", icon: Map },
    { to: "/sprints", label: "Sprints", icon: Timer },
  ] },
  { label: "Compete", items: [
    { to: "/events", label: "Events", icon: CalendarDays },
    { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { to: "/live-quiz", label: "Live quiz", icon: Radio },
    { to: "/history", label: "Test history", icon: History },
  ] },
  { label: "Your work", items: [
    { to: "/projects", label: "Projects", icon: FolderKanban },
    { to: "/certificates", label: "Certificates", icon: Award },
    { to: "/saved", label: "Saved", icon: Bookmark },
    { to: "/referrals", label: "Referrals", icon: Gift },
  ] },
  { label: "Club", items: [
    { to: "/gallery", label: "Gallery", icon: Images },
    { to: "/contact", label: "Contact", icon: Mail },
  ] },
];
export const studentDock = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/arena", label: "Arena", icon: Swords },
  { to: "/problems", label: "Problems", icon: Puzzle },
  { to: "/events", label: "Events", icon: CalendarDays },
];

export const guestRail = [
  { label: "Explore", items: [
    { to: "/", label: "Home", icon: Home, end: true },
    { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { to: "/events", label: "Events", icon: CalendarDays },
    { to: "/gallery", label: "Gallery", icon: Images },
  ] },
  { label: "Club", items: [
    { to: "/contact", label: "Contact", icon: Mail },
    { to: "/verify", label: "Verify a certificate", icon: BadgeCheck },
  ] },
];
export const guestDock = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  { to: "/events", label: "Events", icon: CalendarDays },
  { to: "/gallery", label: "Gallery", icon: Images },
];

export const teacherRail = [
  { label: "Teaching", items: [
    { to: "/teacher", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/teacher/students", label: "Students", icon: Users },
    { to: "/teacher/challenges", label: "Challenges", icon: Lightbulb },
    { to: "/teacher/quiz", label: "Live quiz", icon: PlayCircle },
  ] },
  { label: "Records", items: [
    { to: "/teacher/certificates", label: "Certificates", icon: FileBadge },
    { to: "/teacher/scanner", label: "Event scanner", icon: ScanLine },
  ] },
];
export const teacherDock = teacherRail[0].items;

export const adminRail = [
  { label: "Operations", items: [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/challenges", label: "Challenges", icon: Lightbulb },
    { to: "/admin/events", label: "Events", icon: CalendarDays },
    { to: "/admin/moderation", label: "Moderation", icon: ShieldCheck },
    { to: "/admin/recruitment", label: "Recruitment", icon: UserPlus },
  ] },
  { label: "System", items: [
    { to: "/admin/data", label: "Data", icon: Database },
    { to: "/admin/features", label: "Features", icon: ToggleRight },
    { to: "/admin/settings", label: "Settings", icon: Settings },
  ] },
];
export const adminDock = adminRail[0].items.slice(0, 4);

export const superAdminRail = [
  { label: "Platform", items: [
    { to: "/super-admin", label: "Analytics", icon: BarChart3, end: true },
    { to: "/super-admin/organisations", label: "Organisations", icon: Building2 },
    { to: "/super-admin/plans", label: "Plans and billing", icon: CreditCard },
    { to: "/super-admin/access", label: "Access control", icon: KeyRound },
  ] },
];
export const superAdminDock = superAdminRail[0].items;
