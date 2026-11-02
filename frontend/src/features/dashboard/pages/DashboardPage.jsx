import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import {
  ArrowUpRight, Award, Bell, Check, CheckCircle2, Megaphone, Target, Users, X, Zap,
} from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { PageHeader, StatTile, SegmentedTabs, AsymptoteCurve } from "@/components/lamp";
import { ScrollCurve } from "@/components/motion/ScrollFx";
import { user, arena, announcements as announcementsApi, notifications as notifApi, chat, achievements as achievementsApi } from "@/lib/api";
import AchievementBadge from "@/components/ui/AchievementBadge";
import UserHoverCard from "@/components/social/UserHoverCard";
import DailyProblemCard from "@/features/dashboard/components/DailyProblemCard";
import SprintWidget from "@/features/sprints/components/SprintWidget";

const ICON = { strokeWidth: 1.75 };

/** "Monday evening" — the context line above the welcome. */
function timeContext(now = new Date()) {
  const day = now.toLocaleDateString(undefined, { weekday: "long" });
  const h = now.getHours();
  const part = h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
  return `${day} ${part}`;
}

/** Small section heading used inside panels. */
function PanelTitle({ icon: Icon, children, aside }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg text-text-primary">
        {Icon ? <Icon className="h-4 w-4 text-text-dim" aria-hidden="true" {...ICON} /> : null}
        {children}
      </h2>
      {aside}
    </div>
  );
}

function Avatar({ person, size = "h-9 w-9" }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-sm`}
      style={{ background: person.avatar_color || "linear-gradient(135deg, rgb(var(--violet)), rgb(var(--lamp)/0.8))" }}
    >
      {person.avatar_emoji || person.name?.charAt(0) || "?"}
    </div>
  );
}

/** Friends card — shows friends list + pending requests + search */
function FriendsCard() {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState("friends"); // friends | pending | search
  const [loadError, setLoadError] = useState(false);

  const loadFriendsData = () => {
    setLoadError(false);
    // Launch both requests; any failure trips the error flag so the
    // widget surfaces a small retry affordance. Success on either
    // partially populates the UI — better than silent empty state.
    let hadError = false;
    const tripError = () => { if (!hadError) { hadError = true; setLoadError(true); } };
    chat.getFriends().then((r) => setFriends(r.data || [])).catch(tripError);
    chat.getPending().then((r) => setPending(r.data || [])).catch(tripError);
  };

  useEffect(loadFriendsData, []);

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    try { const { data } = await chat.searchUsers(q); setResults(data || []); } catch { setResults([]); }
  };

  const rowClass = "flex min-h-[48px] items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.04]";

  return (
    <section data-reveal="up" className="lamp-panel p-5">
      <PanelTitle
        icon={Users}
        aside={pending.length > 0 ? (
          <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[12px] font-medium text-secondary">{pending.length} new</span>
        ) : null}
      >
        Friends {friends.length > 0 && <span className="text-text-dim">{friends.length}</span>}
      </PanelTitle>
      {loadError && (
        <p className="mt-2 text-[13px] text-text-dim">
          Couldn&apos;t load friends.{" "}
          <button onClick={loadFriendsData} className="text-primary hover:underline">Retry</button>
        </p>
      )}

      <SegmentedTabs
        size="sm"
        aria-label="Friends view"
        className="mt-4 flex w-full [&>button]:flex-1"
        value={tab}
        onChange={setTab}
        items={[
          { value: "friends", label: "Friends" },
          { value: "pending", label: "Requests", count: pending.length || undefined },
          { value: "search", label: "Find" },
        ]}
      />

      <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
        {/* Friends list */}
        {tab === "friends" && (
          friends.length === 0 ? (
            <p className="py-5 text-center text-[13px] text-text-dim">No friends yet. Use Find to add classmates.</p>
          ) : (
            friends.map((f) => (
              <Link key={f.user_id} to={`/profile/${f.user_id}`} className={rowClass}>
                <Avatar person={f} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary">
                    <UserHoverCard userId={f.user_id}>{f.name}</UserHoverCard>
                  </p>
                  <p className="text-[12px] text-text-dim">{f.title || "Student"}</p>
                </div>
              </Link>
            ))
          )
        )}

        {/* Pending requests */}
        {tab === "pending" && (
          pending.length === 0 ? (
            <p className="py-5 text-center text-[13px] text-text-dim">No pending requests</p>
          ) : (
            pending.map((req) => (
              <div key={req.id} className={rowClass}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary">
                    {req.requester?.user_id
                      ? <UserHoverCard userId={req.requester.user_id}>{req.requester?.name || "User"}</UserHoverCard>
                      : (req.requester?.name || "User")}
                  </p>
                </div>
                <button onClick={async () => {
                  await chat.respondRequest(req.id, true);
                  setPending((p) => p.filter((r) => r.id !== req.id));
                  chat.getFriends().then((r) => setFriends(r.data || []));
                }} className="h-10 rounded-xl bg-success/15 px-3 text-[13px] font-medium text-success transition hover:bg-success/25">Accept</button>
                <button onClick={async () => {
                  await chat.respondRequest(req.id, false);
                  setPending((p) => p.filter((r) => r.id !== req.id));
                }} className="h-10 rounded-xl bg-danger/10 px-3 text-[13px] font-medium text-danger transition hover:bg-danger/20">Decline</button>
              </div>
            ))
          )
        )}

        {/* Search people */}
        {tab === "search" && (
          <>
            <input value={search} onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search name or email..."
              className="mb-1 h-11 w-full rounded-xl border border-[rgb(var(--rule))] bg-obsidian/40 px-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/40" />
            {results.map((u) => (
              <div key={u.user_id} className={rowClass}>
                <Avatar person={u} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary">
                    <UserHoverCard userId={u.user_id}>{u.name}</UserHoverCard>
                  </p>
                  <p className="text-[12px] tabular-nums text-text-dim">{u.xp || 0} XP</p>
                </div>
                <Link to={`/profile/${u.user_id}`} className="flex h-10 items-center rounded-xl bg-primary/10 px-3 text-[13px] font-medium text-primary transition hover:bg-primary/20">
                  View
                </Link>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * XP progress — the asymptote as a meter. The dot parks at the share
 * of the way from the current title to the next one; the ladder below
 * lights rung by rung up to where the viewer stands.
 */
function ProgressPanel({ xp, ladder, currentTitle }) {
  const root = useRef(null);
  const rungs = useMemo(
    () => (Array.isArray(ladder) ? [...ladder].sort((a, b) => (a.minXp || 0) - (b.minXp || 0)) : []),
    [ladder],
  );
  const currentIdx = Math.max(0, rungs.reduce((acc, t, i) => (xp >= (t.minXp || 0) ? i : acc), 0));
  const cur = rungs[currentIdx];
  const next = rungs[currentIdx + 1];
  const span = next ? Math.max(1, next.minXp - (cur?.minXp || 0)) : 1;
  const progress = next ? Math.min(1, Math.max(0, (xp - (cur?.minXp || 0)) / span)) : 1;
  const toGo = next ? Math.max(0, next.minXp - xp) : 0;

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root.current, start: "top 82%", once: true },
        defaults: { ease: "expo.out" },
      });
      tl.fromTo("[data-fill]", { scaleX: 0 }, { scaleX: progress, duration: 1.6 })
        .from("[data-rung]", { x: -18, autoAlpha: 0, duration: 0.7, stagger: 0.07 }, 0.15)
        .from("[data-rung-dot][data-on='true']", { scale: 0, duration: 0.5, stagger: 0.08, ease: "back.out(3)" }, 0.4);
    });
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set("[data-fill]", { scaleX: progress });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [progress], revertOnUpdate: true });

  return (
    <section ref={root} className="lamp-panel p-5 sm:p-7">
      <PanelTitle icon={Zap}>Your progress</PanelTitle>

      <div className="mt-5 grid items-end gap-6 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="text-[13px] text-text-muted">
            {next ? <>Toward <span className="text-text-primary">{next.title}</span></> : "Top of the ladder"}
          </p>
          <p className="lamp-numerals mt-1 text-4xl leading-none text-text-primary sm:text-5xl">
            <AnimatedNumber value={xp} duration={1.6} />
            <span className="ml-2 text-base text-text-dim">XP</span>
          </p>
          <p className="mt-2 text-[13px] text-primary">
            {next ? `${toGo.toLocaleString()} XP to go` : "Every title unlocked"}
          </p>
        </div>
        <AsymptoteCurve progress={progress} className="h-20 w-full max-w-[300px] sm:w-64" />
      </div>

      <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          data-fill
          className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-[linear-gradient(90deg,rgb(var(--violet)),rgb(var(--lamp)))]"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {rungs.length > 0 && (
        <ol className="mt-6 grid gap-1 sm:grid-cols-2">
          {rungs.map((t, i) => {
            const isCurrent = t.title === currentTitle || (!currentTitle && i === currentIdx);
            const reached = i <= currentIdx;
            return (
              <li
                key={t.title}
                data-rung
                className={`flex min-h-[44px] items-center justify-between gap-3 rounded-xl px-3 py-2 ${
                  isCurrent ? "bg-primary/10 ring-1 ring-primary/30" : ""
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    data-rung-dot
                    data-on={reached ? "true" : "false"}
                    className={`h-2 w-2 rounded-full ${reached ? "bg-primary shadow-[0_0_8px_rgb(var(--lamp)/0.8)]" : "bg-white/15"}`}
                  />
                  <span className={`text-sm ${isCurrent ? "font-medium text-text-primary" : reached ? "text-text-muted" : "text-text-dim"}`}>
                    {t.title}
                  </span>
                  {isCurrent && <span className="text-[12px] text-primary">You</span>}
                </span>
                <span className="text-[12px] tabular-nums text-text-dim">{t.minXp} XP</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [arenaStats, setArenaStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      user.profile().catch(() => ({ data: null })),
      user.stats().catch(() => ({ data: null })),
      arena.stats().catch(() => ({ data: null })),
      arena.history().catch(() => ({ data: [] })),
      announcementsApi.list().catch(() => ({ data: [] })),
      notifApi.list().catch(() => ({ data: [] })),
    ]).then(([p, s, as, h, ann, n]) => {
      setProfile(p.data);
      setStats(s.data);
      setArenaStats(as.data);
      setHistory(Array.isArray(h.data) ? h.data.slice(0, 8) : []);
      setAnnouncements(Array.isArray(ann.data) ? ann.data.slice(0, 3) : []);
      setNotifs(Array.isArray(n.data) ? n.data.slice(0, 5) : []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="pb-16">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader variant="orbit" size="lg" label="Loading dashboard..." />
        </div>
      </div>
    );
  }

  const firstName = profile?.name ? profile.name.split(" ")[0] : "";
  const xp = Number(stats?.xp || profile?.xp || 0);
  const accuracy = Number.parseFloat(stats?.accuracy || arenaStats?.accuracy || 0) || 0;
  const currentTitle = stats?.title || profile?.title;

  return (
    <div className="pb-16">
      <PageHeader
        context={timeContext()}
        title={firstName ? `Welcome back, *${firstName}*.` : "Welcome back."}
        description={currentTitle ? `You're standing at ${currentTitle}. Here's what's on the desk today.` : "Here's what's on the desk today."}
        actions={(
          <Link to="/profile">
            <Button variant="secondary" size="sm">View profile</Button>
          </Link>
        )}
      />

      {/* Stats — tiles count up on first render. */}
      <section data-stagger="fog" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Total XP" value={xp} icon={Zap} sub={`Rank #${stats?.rank || "—"}`} tone="lamp" />
        <StatTile
          label="Problems solved"
          value={Number(stats?.solved || arenaStats?.correct || 0)}
          icon={CheckCircle2}
          sub={`of ${stats?.total || arenaStats?.total || 0} attempted`}
        />
        <StatTile label="Accuracy" value={accuracy} suffix="%" icon={Target} sub={`${arenaStats?.correct || 0} correct`} tone="good" />
        <StatTile
          label="Title"
          value={stats?.title || profile?.title || "Novice"}
          icon={Award}
          sub={stats?.nextTitle ? `Next: ${stats.nextTitle}` : "Highest title reached"}
          tone="warn"
        />
      </section>

      {/* The asymptote draws itself as you scroll down onto the desk. */}
      <div className="relative mt-6">
        <ScrollCurve className="relative h-10 sm:h-14" start="top 92%" end="top 35%" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-8">
        <div className="min-w-0 space-y-6">
          {/* The lit panel: today's problem. */}
          <DailyProblemCard />

          {stats?.xpTitles && (
            <div data-reveal="up">
              <ProgressPanel xp={xp} ladder={stats.xpTitles} currentTitle={currentTitle} />
            </div>
          )}

          {/* Recent attempts */}
          <section data-reveal="up" className="lamp-panel p-5 sm:p-7">
            <PanelTitle
              icon={Target}
              aside={(
                <Link to="/history" className="inline-flex h-10 items-center gap-1 text-[13px] font-medium text-primary transition hover:text-text-primary">
                  View all <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" {...ICON} />
                </Link>
              )}
            >
              Recent attempts
            </PanelTitle>
            {history.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[rgb(var(--rule))] px-4 py-8 text-center">
                <p className="text-sm text-text-muted">No attempts yet.</p>
                <Link to="/arena" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Solve your first challenge in the arena</Link>
              </div>
            ) : (
              <ul data-stagger="left" className="mt-4 divide-y divide-[rgb(var(--rule))]">
                {history.map((item, i) => {
                  const ok = item.is_correct || item.correct;
                  const earned = item.xp_earned || item.points_earned || 0;
                  return (
                    <li key={item.id || i} className="flex items-center gap-3 py-3 sm:gap-4">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        ok ? "bg-success/12 text-success" : "bg-danger/10 text-danger"
                      }`}>
                        {ok ? <Check className="h-4 w-4" aria-label="Correct" {...ICON} /> : <X className="h-4 w-4" aria-label="Incorrect" {...ICON} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-text-primary">{item.challenge_title || item.title || "Challenge"}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-text-dim">
                          {item.difficulty ? <span className="capitalize">{item.difficulty}</span> : null}
                          {item.created_at ? <span>{new Date(item.created_at).toLocaleDateString()}</span> : null}
                        </p>
                      </div>
                      <span className={`lamp-numerals text-sm ${earned > 0 ? "text-success" : "text-text-dim"}`}>
                        +{earned}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="min-w-0 space-y-6">
          {/* Solution Sprint — weekly featured problem with a
              window-scoped leaderboard. */}
          <div data-reveal="right"><SprintWidget /></div>

          {/* Announcements */}
          <section data-reveal="right" className="lamp-panel p-5">
            <PanelTitle icon={Megaphone}>Announcements</PanelTitle>
            {announcements.length === 0 ? (
              <p className="mt-3 text-[13px] text-text-dim">Nothing new from the team.</p>
            ) : (
              <div data-stagger="up" className="mt-4 space-y-4">
                {announcements.map((ann, i) => (
                  <article key={ann.id || i} className="border-l-2 border-primary/50 pl-3">
                    <p className="text-sm font-medium text-text-primary">{ann.title}</p>
                    <p className="mt-1 text-[13px] leading-5 text-text-muted">{ann.content || ann.body}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Notifications preview */}
          <section data-reveal="right" className="lamp-panel p-5">
            <PanelTitle
              icon={Bell}
              aside={<Link to="/notifications" className="inline-flex h-10 items-center text-[13px] font-medium text-primary transition hover:text-text-primary">View all</Link>}
            >
              Notifications
            </PanelTitle>
            {notifs.length === 0 ? (
              <p className="mt-3 text-[13px] text-text-dim">All caught up.</p>
            ) : (
              <ul data-stagger="up" className="mt-3 space-y-1">
                {notifs.map((n, i) => (
                  <li key={n.id || i} className="flex items-start gap-3 rounded-xl px-2 py-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-white/15" : "bg-primary shadow-[0_0_8px_rgb(var(--lamp)/0.9)]"}`} />
                    <p className={`line-clamp-2 text-[13px] ${n.is_read ? "text-text-dim" : "text-text-muted"}`}>{n.body || n.title}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Friends */}
          <FriendsCard />

          {/* Recent Achievements */}
          <RecentAchievements />

          {/* Quick actions */}
          <section data-reveal="right" className="lamp-panel p-5">
            <PanelTitle>Jump to</PanelTitle>
            <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-1">
              <Link to="/arena" className="col-span-2 xl:col-span-1"><Button size="sm" className="w-full justify-center">Enter arena</Button></Link>
              <Link to="/live-quiz" className="col-span-2 xl:col-span-1"><Button variant="secondary" size="sm" className="w-full justify-center">Join live quiz</Button></Link>
              <Link to="/certificates"><Button variant="ghost" size="sm" className="w-full justify-center">Certificates</Button></Link>
              <Link to="/projects"><Button variant="ghost" size="sm" className="w-full justify-center">Projects</Button></Link>
              <Link to="/referrals" className="col-span-2 xl:col-span-1"><Button variant="ghost" size="sm" className="w-full justify-center">Invite friends</Button></Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Recent achievements mini-card for dashboard sidebar */
function RecentAchievements() {
  const [myAch, setMyAch] = useState([]);
  const [allAch, setAllAch] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      achievementsApi.mine().catch(() => ({ data: [] })),
      achievementsApi.list().catch(() => ({ data: [] })),
    ]).then(([mine, all]) => {
      setMyAch(Array.isArray(mine.data) ? mine.data : []);
      setAllAch(Array.isArray(all.data) ? all.data : []);
      setLoading(false);
    });
  }, []);

  const unlockedIds = new Set(myAch.map(u => u.achievement_id));
  const recent = myAch.slice(0, 3);

  if (loading) return null;
  if (allAch.length === 0) return null;

  return (
    <section data-reveal="right" className="lamp-panel p-5">
      <PanelTitle
        icon={Award}
        aside={<span className="text-[13px] tabular-nums text-text-dim">{unlockedIds.size} of {allAch.length}</span>}
      >
        Achievements
      </PanelTitle>
      {recent.length === 0 ? (
        <p className="mt-3 text-[13px] text-text-dim">No achievements unlocked yet. Attend an event or solve a challenge to earn your first.</p>
      ) : (
        <div data-stagger="scale" className="mt-3 space-y-2">
          {recent.map(u => {
            const ach = u.achievements || allAch.find(a => a.id === u.achievement_id);
            if (!ach) return null;
            return <AchievementBadge key={u.id} achievement={ach} unlocked compact />;
          })}
        </div>
      )}
      <Link to="/profile" className="mt-3 inline-flex h-10 items-center gap-1 text-[13px] font-medium text-primary transition hover:text-text-primary">
        View all achievements
      </Link>
    </section>
  );
}
