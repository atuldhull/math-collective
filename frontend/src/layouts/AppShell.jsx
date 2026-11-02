/**
 * AppShell — the Lamplight frame every non-home route lives in.
 *
 *   desktop (lg+)   a fixed rail on the left with grouped navigation and
 *                   a lamp-lit indicator that glides between items; a
 *                   slim top bar with search, theme, bell and account.
 *   phone / tablet  a compact top bar, a floating dock of four shortcuts
 *                   plus "More", which opens a sheet holding every
 *                   destination and the account actions.
 *
 * The shell stays mounted while the outlet changes, so only the page
 * itself does the 3D swap (LampRouteTransition) while the glyph warp
 * (WarpOverlay, mounted by the router) streaks past.
 *
 * Every portal layout (teacher, admin, super-admin, core team) and the
 * main app layout render through this with their own `groups`.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import {
  Bell, ChevronUp, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search, X,
} from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/store/auth-store";
import { MEMBER_THEMES, useMemberTheme } from "@/components/lamp/memberTheme";
import { RAIL_FOLDED, RAIL_OPEN, useRail } from "@/components/lamp/railState";
import AnnouncementBar from "@/components/AnnouncementBar";
import InstallPwaButton from "@/components/ui/InstallPwaButton";
import Loader from "@/components/ui/Loader";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import CommandPalette from "@/components/search/CommandPalette";
import { useCommandPaletteHotkey } from "@/components/search/useCommandPaletteHotkey";
import LampBackdrop from "@/components/lamp/LampBackdrop";
import SeasonAmbience from "@/components/lamp/SeasonAmbience";
import { SEASON_NAMES, useSeason } from "@/components/lamp/season";
import LampRouteTransition from "@/components/lamp/LampRouteTransition";
import useAutoReveal from "@/components/lamp/useAutoReveal";
import { transitionFor } from "@/components/lamp/transitionEffects";

const themeName = (id) => MEMBER_THEMES.find((t) => t.id === id)?.name || "Obsidian";

// Three-colour chip for a theme: paper, accent, second accent.
function ThemeSwatch({ id, className }) {
  const t = MEMBER_THEMES.find((x) => x.id === id) || MEMBER_THEMES[0];
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 rounded-full ring-1 ring-[rgb(var(--rule))]", className || "h-3.5 w-3.5")}
      style={{ background: `conic-gradient(${t.swatch[1]} 0 33%, ${t.swatch[2]} 0 66%, ${t.swatch[0]} 0)` }}
    />
  );
}

function isActivePath(pathname, item) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function useAccountLinks() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const personal = [
    { to: "/profile", label: "Profile" },
    { to: "/notifications", label: "Notifications" },
    { to: "/saved", label: "Saved" },
    { to: "/certificates", label: "Certificates" },
    { to: "/billing", label: "Billing" },
  ];
  const portals = [{ to: "/dashboard", label: "Student app" }, { to: "/core", label: "Core team" }];
  if (role === "teacher" || role === "admin" || role === "super_admin") portals.push({ to: "/teacher", label: "Teacher panel" });
  if (role === "admin" || role === "super_admin") portals.push({ to: "/admin", label: "Admin" });
  if (role === "super_admin") portals.push({ to: "/super-admin", label: "Super admin" });
  return { personal, portals };
}

function Brand({ to = "/" }) {
  return (
    <Link to={to} className="group flex min-w-0 items-center gap-2.5" aria-label="Asymptotes home">
      <img
        src="/app/brand/club-logo-128.webp"
        srcSet="/app/brand/club-logo-128.webp 1x, /app/brand/club-logo-256.webp 2x"
        alt=""
        width="40"
        height="40"
        className="h-10 w-10 shrink-0 object-contain transition-transform duration-700 ease-[var(--ease-lamp)] group-hover:rotate-[-8deg] group-hover:scale-110"
      />
      <span className="lamp-display truncate text-[1.15rem] text-text-primary">Asymptotes</span>
    </Link>
  );
}

function Avatar({ user, size = "md" }) {
  const initial = (user?.name || user?.email || "U")[0].toUpperCase();
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(140deg,rgb(var(--violet)),rgb(var(--lamp)))] font-display font-semibold text-white",
        size === "sm" ? "h-8 w-8 text-sm" : "h-9 w-9 text-[15px]",
      )}
    >
      {initial}
    </span>
  );
}

/** On/off switch for this month's season pack; hidden when none applies. */
function SeasonToggle({ className }) {
  const current = useSeason((s) => s.current);
  const off = useSeason((s) => s.off);
  const toggle = useSeason((s) => s.toggle);
  if (!current) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!off}
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      className={className}
    >
      {SEASON_NAMES[current]} effects
      <span className={cn("relative ml-auto inline-flex h-5 w-9 shrink-0 rounded-full transition-colors", off ? "bg-white/15" : "bg-primary")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-text-primary transition-all", off ? "left-0.5" : "left-[1.125rem]")} />
      </span>
    </button>
  );
}

function RailLink({ item, pathname, folded }) {
  const active = isActivePath(pathname, item);
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      data-rail-item
      title={folded ? item.label : undefined}
      aria-label={folded ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl py-2.5 text-[14.5px] transition-colors duration-300",
        folded ? "justify-center px-0" : "px-3",
        active ? "text-text-primary" : "text-text-muted hover:text-text-primary",
      )}
    >
      {active ? (
        <motion.span
          layoutId="rail-active"
          className="absolute inset-0 rounded-xl bg-[rgb(var(--lamp)/0.10)] ring-1 ring-[rgb(var(--lamp)/0.18)]"
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        >
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_rgb(var(--lamp)/0.9)]" />
        </motion.span>
      ) : null}
      {Icon ? (
        <Icon
          aria-hidden="true"
          strokeWidth={1.75}
          className={cn(
            "relative h-[18px] w-[18px] shrink-0 transition-transform duration-500 ease-[var(--ease-lamp)] group-hover:-rotate-6 group-hover:scale-110",
            active ? "text-primary" : "",
          )}
        />
      ) : null}
      <span className={cn("relative whitespace-nowrap", active && "font-semibold", folded && "sr-only")}>{item.label}</span>
    </NavLink>
  );
}

function AccountMenu({ user, onLogout, upward = false, folded = false, onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { personal, portals } = useAccountLinks();
  const theme = useMemberTheme((s) => s.theme);
  const toggleTheme = useMemberTheme((s) => s.cycle);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl text-left transition",
          upward && !folded ? "border border-[rgb(var(--rule))] bg-surface/60 p-2.5 hover:border-[rgb(var(--lamp)/0.3)]" : "justify-center p-0.5",
        )}
      >
        <Avatar user={user} size={upward ? "md" : "sm"} />
        {upward && !folded ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-text-primary">{user?.name || "Member"}</span>
              <span className="block truncate text-xs capitalize text-text-dim">{(user?.role || "student").replace("_", " ")}</span>
            </span>
            <ChevronUp className={cn("h-4 w-4 text-text-dim transition-transform duration-300", !open && "rotate-180")} />
          </>
        ) : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: upward ? 10 : -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: upward ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute z-50 w-60 rounded-2xl border border-[rgb(var(--rule))] bg-panel/95 p-1.5 shadow-panel backdrop-blur-2xl",
              upward ? "bottom-full left-0 mb-2 origin-bottom-left" : "right-0 top-full mt-2 origin-top-right",
            )}
            onClick={() => { setOpen(false); onNavigate?.(); }}
          >
            {!upward ? (
              <div className="px-3 pb-2 pt-2">
                <p className="truncate text-sm font-semibold text-text-primary">{user?.name || "Member"}</p>
                <p className="truncate text-xs text-text-dim">{user?.email}</p>
              </div>
            ) : null}
            {personal.map((l) => (
              <Link key={l.to} to={l.to} role="menuitem" className="block rounded-xl px-3 py-2 text-sm text-text-muted transition hover:bg-white/[0.05] hover:text-text-primary">{l.label}</Link>
            ))}
            <div className="my-1.5 h-px bg-[rgb(var(--rule))]" />
            {portals.map((l) => (
              <Link key={l.to} to={l.to} role="menuitem" className="block rounded-xl px-3 py-2 text-sm text-primary/90 transition hover:bg-[rgb(var(--lamp)/0.08)]">{l.label}</Link>
            ))}
            <div className="my-1.5 h-px bg-[rgb(var(--rule))]" />
            <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); toggleTheme(); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-text-muted transition hover:bg-white/[0.05] hover:text-text-primary">
              Theme <span className="inline-flex items-center gap-1.5 text-text-dim"><ThemeSwatch id={theme} />{themeName(theme)}</span>
            </button>
            <SeasonToggle className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-text-muted transition hover:bg-white/[0.05] hover:text-text-primary" />
            <button type="button" role="menuitem" onClick={onLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-danger transition hover:bg-danger/[0.08]">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MoreSheet({ open, onClose, groups, isAuth, user, onLogout, onSearch }) {
  const { personal, portals } = useAccountLinks();
  const theme = useMemberTheme((s) => s.theme);
  const setTheme = useMemberTheme((s) => s.setTheme);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const list = {
    hidden: {},
    show: { transition: { staggerChildren: 0.035, delayChildren: 0.12 } },
  };
  const row = {
    hidden: { opacity: 0, y: 18, rotateX: -30 },
    show: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-[rgb(var(--color-obsidian)/0.7)] backdrop-blur-sm lg:hidden"
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="All destinations"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose(); }}
            className="fixed inset-x-0 bottom-0 z-[61] max-h-[86vh] overflow-hidden rounded-t-[1.75rem] border-t border-[rgb(var(--rule))] bg-panel/95 backdrop-blur-2xl lg:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <span className="mx-auto h-1.5 w-12 rounded-full bg-[rgb(var(--rule))]" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3">
              <p className="lamp-display text-2xl text-text-primary">Go anywhere</p>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-text-muted hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <motion.div variants={list} initial="hidden" animate="show" className="max-h-[calc(86vh-6rem)] space-y-5 overflow-y-auto px-5 pb-8 [perspective:800px]">
              {isAuth ? (
                <motion.button variants={row} type="button" onClick={() => { onClose(); onSearch(); }} className="flex w-full items-center gap-3 rounded-2xl border border-[rgb(var(--rule))] bg-surface/70 px-4 py-3.5 text-left text-sm text-text-muted">
                  <Search className="h-4 w-4" /> Search problems, people and events
                </motion.button>
              ) : null}
              {groups.map((g) => (
                <div key={g.label}>
                  <motion.p variants={row} className="mb-2 text-xs font-medium text-text-dim">{g.label}</motion.p>
                  <div className="grid grid-cols-2 gap-2">
                    {g.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActivePath(pathname, item);
                      return (
                        <motion.div key={item.to} variants={row}>
                          <Link
                            to={item.to}
                            onClick={onClose}
                            className={cn(
                              "flex h-full items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-sm transition",
                              active
                                ? "border-[rgb(var(--lamp)/0.35)] bg-[rgb(var(--lamp)/0.10)] text-text-primary"
                                : "border-[rgb(var(--rule))] bg-surface/50 text-text-muted",
                            )}
                          >
                            {Icon ? <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} strokeWidth={1.75} /> : null}
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {isAuth ? (
                <div>
                  <motion.p variants={row} className="mb-2 text-xs font-medium text-text-dim">Account</motion.p>
                  <motion.div variants={row} className="flex items-center gap-3 rounded-2xl border border-[rgb(var(--rule))] bg-surface/50 p-3">
                    <Avatar user={user} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{user?.name}</p>
                      <p className="truncate text-xs text-text-dim">{user?.email}</p>
                    </div>
                  </motion.div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[...personal, ...portals].map((l) => (
                      <motion.div key={l.to} variants={row}>
                        <Link to={l.to} onClick={onClose} className="block rounded-2xl border border-[rgb(var(--rule))] bg-surface/50 px-3.5 py-3 text-sm text-text-muted">{l.label}</Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <motion.p variants={row} className="mb-2 text-xs font-medium text-text-dim">Theme</motion.p>
                <div className="grid grid-cols-2 gap-2">
                  {MEMBER_THEMES.map((t) => (
                    <motion.button
                      key={t.id}
                      variants={row}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      aria-pressed={theme === t.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left text-sm transition",
                        theme === t.id ? "border-[rgb(var(--lamp)/0.45)] bg-[rgb(var(--lamp)/0.10)] text-text-primary" : "border-[rgb(var(--rule))] bg-surface/50 text-text-muted",
                      )}
                    >
                      <ThemeSwatch id={t.id} className="h-4 w-4" />
                      <span className="truncate">{t.name}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
              <motion.div variants={row}>
                <SeasonToggle className="flex w-full items-center gap-3 rounded-2xl border border-[rgb(var(--rule))] bg-surface/50 px-4 py-3 text-left text-sm text-text-muted" />
              </motion.div>
              <motion.div variants={row} className="flex gap-2">
                {isAuth ? (
                  <button type="button" onClick={() => { onClose(); onLogout(); }} className="flex-1 rounded-2xl border border-danger/25 bg-danger/[0.08] px-4 py-3 text-sm text-danger">
                    Sign out
                  </button>
                ) : (
                  <Link to="/login" onClick={onClose} className="flex-1 rounded-2xl border border-[rgb(var(--rule))] bg-surface/50 px-4 py-3 text-center text-sm text-text-primary">
                    Sign in
                  </Link>
                )}
              </motion.div>
              {!isAuth ? (
                <motion.div variants={row}>
                  <Link to="/register" onClick={onClose} className="block rounded-2xl bg-primary px-4 py-3.5 text-center text-sm font-semibold text-[rgb(var(--color-obsidian))]">
                    Join the collective
                  </Link>
                </motion.div>
              ) : null}
              <motion.div variants={row}><InstallPwaButton className="px-1" /></motion.div>
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader variant="orbit" size="lg" label="Opening the page" />
    </div>
  );
}

export default function AppShell({ groups, dock, badge, railTop, homeTo = "/" }) {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const logout = useAuthStore((s) => s.logout);
  const theme = useMemberTheme((s) => s.theme);
  const toggleTheme = useMemberTheme((s) => s.cycle);
  const isAuth = status === "authenticated" && !!user;
  const [moreOpen, setMoreOpen] = useState(false);
  const folded = useRail((s) => s.collapsed);
  const toggleRail = useRail((s) => s.toggle);
  const RailIcon = folded ? PanelLeftOpen : PanelLeftClose;

  useEffect(() => {
    document.documentElement.style.setProperty("--rail-w", `${folded ? RAIL_FOLDED : RAIL_OPEN}px`);
  }, [folded]);
  useEffect(() => () => document.documentElement.style.removeProperty("--rail-w"), []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteHotkey(paletteOpen, setPaletteOpen);

  const shellRef = useRef(null);
  const mainRef = useRef(null);
  useAutoReveal(mainRef);

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  // The shell's own entrance: the rail slides in from the dark and its
  // items fall into place, the dock rises from below the screen.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(shellRef);
      gsap.timeline({ defaults: { ease: "expo.out" } })
        .from(q("[data-rail]"), { xPercent: -100, duration: 1.1 })
        .from(q("[data-rail-item], [data-rail-label]"), { x: -24, autoAlpha: 0, duration: 0.8, stagger: 0.03 }, 0.25)
        .from(q("[data-topbar]"), { y: -30, autoAlpha: 0, duration: 0.9 }, 0.15)
        .from(q("[data-dock]"), { yPercent: 160, duration: 1.1 }, 0.3);
    });
    return () => mm.revert();
  }, { scope: shellRef });

  const allItems = groups.flatMap((g) => g.items);
  const current = allItems.find((i) => isActivePath(pathname, i));
  const dockItems = dock.slice(0, 4);
  const dockHasActive = dockItems.some((i) => isActivePath(pathname, i));

  return (
    <div ref={shellRef} className="relative min-h-screen bg-obsidian text-text-primary">
      <LampBackdrop />
      <SeasonAmbience />

      {/* ── Desktop rail ── */}
      <aside
        data-rail
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--rail-w,256px)] flex-col overflow-hidden border-r border-[rgb(var(--rule))] bg-[rgb(var(--color-obsidian)/0.82)] backdrop-blur-2xl transition-[width] duration-500 ease-[var(--ease-lamp)] lg:flex"
      >
        <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 pb-4 pt-5", folded ? "justify-center px-2" : "px-5")}>
          {folded ? (
            <Link to={homeTo} aria-label="Asymptotes home" className="flex h-10 w-10 items-center justify-center">
              <img src="/app/brand/club-logo-128.webp" alt="" width="40" height="40" className="h-10 w-10 object-contain" />
            </Link>
          ) : (
            <div className="shrink-0"><Brand to={homeTo} /></div>
          )}
          {badge && !folded ? (
            <span className="rounded-full border border-[rgb(var(--violet)/0.4)] bg-[rgb(var(--violet)/0.12)] px-2 py-0.5 text-[11px] font-semibold text-[rgb(var(--violet))]">
              {badge}
            </span>
          ) : null}
        </div>
        {railTop && !folded ? <div className="px-4 pb-3">{railTop}</div> : null}
        <nav data-lenis-prevent className={cn("scrollbar-none flex-1 overflow-y-auto overscroll-contain pb-4 pt-2", folded ? "space-y-3 px-2" : "space-y-6 px-3")} aria-label="Main">
          {groups.map((g) => (
            <div key={g.label}>
              {folded ? (
                <div data-rail-label className="mx-auto mb-2 h-px w-8 bg-[rgb(var(--rule))]" />
              ) : (
                <p data-rail-label className="mb-1.5 px-3 text-xs font-medium text-text-dim">{g.label}</p>
              )}
              <div className="space-y-0.5">
                {g.items.map((item) => <RailLink key={item.to} item={item} pathname={pathname} folded={folded} />)}
              </div>
            </div>
          ))}
        </nav>
        <div className={cn("space-y-2 border-t border-[rgb(var(--rule))]", folded ? "p-2" : "p-3")}>
          <button
            type="button"
            onClick={toggleRail}
            aria-label={folded ? "Expand sidebar" : "Collapse sidebar"}
            title={folded ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl py-2 text-sm text-text-dim transition hover:bg-white/[0.05] hover:text-text-primary",
              folded ? "justify-center" : "px-3",
            )}
          >
            <RailIcon className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {folded ? null : <span>Collapse sidebar</span>}
          </button>
          {isAuth ? (
            <AccountMenu user={user} onLogout={handleLogout} upward folded={folded} />
          ) : (
            <div className="lamp-panel lamp-panel--lit p-4">
              <p className="lamp-display text-lg text-text-primary">Join the collective</p>
              <p className="mt-1 text-[13px] leading-5 text-text-muted">Weekly problems, live quizzes and a leaderboard worth climbing.</p>
              <div className="mt-3 flex gap-2">
                <Link to="/register" className="flex-1 rounded-xl bg-primary py-2 text-center text-sm font-semibold text-[rgb(var(--color-obsidian))] transition hover:brightness-110">Join</Link>
                <Link to="/login" className="flex-1 rounded-xl border border-[rgb(var(--rule))] py-2 text-center text-sm text-text-primary transition hover:border-[rgb(var(--lamp)/0.35)]">Sign in</Link>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="relative z-10 flex min-h-screen flex-col transition-[padding] duration-500 ease-[var(--ease-lamp)] lg:pl-[var(--rail-w,256px)]">
        <AnnouncementBar />

        {/* ── Top bar ── */}
        <header data-topbar className="sticky top-0 z-30 border-b border-[rgb(var(--rule)/0.7)] bg-[rgb(var(--color-obsidian)/0.72)] backdrop-blur-2xl">
          <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <div className="lg:hidden"><Brand to={homeTo} /></div>
              {current ? (
                <p className="hidden truncate text-sm text-text-muted lg:block">
                  {badge ? <span className="text-text-dim">{badge} / </span> : null}
                  <span className="text-text-primary">{current.label}</span>
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {isAuth ? (
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Search (Ctrl+K)"
                  className="flex h-10 items-center gap-2.5 rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-3 text-sm text-text-dim transition hover:border-[rgb(var(--lamp)/0.35)] hover:text-text-primary md:w-72"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden md:inline">Search everything</span>
                  <kbd className="ml-auto hidden rounded-md border border-[rgb(var(--rule))] px-1.5 py-0.5 text-[11px] text-text-dim md:inline">Ctrl K</kbd>
                </button>
              ) : null}
              <InstallPwaButton className="hidden md:block" />
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Theme: ${themeName(theme)}. Switch theme`}
                title={themeName(theme)}
                className="hidden h-10 w-10 items-center justify-center rounded-xl text-text-muted transition hover:bg-white/[0.05] hover:text-text-primary md:flex"
              >
                <ThemeSwatch id={theme} className="h-[18px] w-[18px] transition-transform duration-700 ease-[var(--ease-lamp)] hover:rotate-180" />
              </button>
              {isAuth ? (
                <>
                  <Link to="/notifications" aria-label="Notifications" className="flex h-10 w-10 items-center justify-center rounded-xl text-text-muted transition hover:bg-white/[0.05] hover:text-text-primary">
                    <Bell className="h-[18px] w-[18px]" />
                  </Link>
                  <div className="hidden lg:block"><AccountMenu user={user} onLogout={handleLogout} /></div>
                </>
              ) : (
                <div className="hidden items-center gap-2 sm:flex">
                  <Link to="/login" className="rounded-xl px-3.5 py-2 text-sm text-text-muted transition hover:text-text-primary">Sign in</Link>
                  <Link to="/register" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-[rgb(var(--color-obsidian))] transition hover:brightness-110">Join</Link>
                </div>
              )}
            </div>
          </div>
        </header>

        <main
          ref={mainRef}
          className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 pb-[calc(var(--dock-offset)+3rem)] pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10"
        >
          <AnimatePresence mode="wait" initial={false}>
            <LampRouteTransition key={pathname} variant={transitionFor(pathname).motion} className="flex flex-1 flex-col [&>*]:flex-1">
              <RouteErrorBoundary>
                <Suspense fallback={<ShellFallback />}>{outlet}</Suspense>
              </RouteErrorBoundary>
            </LampRouteTransition>
          </AnimatePresence>
        </main>

        <footer className="mx-auto hidden w-full max-w-[1400px] items-center justify-between gap-4 border-t border-[rgb(var(--rule)/0.7)] py-6 pl-24 pr-28 text-[13px] text-text-dim lg:flex">
          <p>Asymptotes, the mathematics club at BMSIT</p>
          <div className="flex gap-5">
            <Link to="/leaderboard" className="transition hover:text-text-primary">Leaderboard</Link>
            <Link to="/events" className="transition hover:text-text-primary">Events</Link>
            <Link to="/gallery" className="transition hover:text-text-primary">Gallery</Link>
            <Link to="/contact" className="transition hover:text-text-primary">Contact</Link>
          </div>
        </footer>
      </div>

      {/* ── Phone dock ── */}
      <nav
        data-dock
        aria-label="Quick navigation"
        className="fixed inset-x-3 z-40 lg:hidden"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto flex h-16 max-w-md items-stretch justify-around rounded-[1.4rem] border border-[rgb(var(--rule))] bg-[rgb(var(--color-surface)/0.88)] px-1 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          {dockItems.map((item) => {
            const active = isActivePath(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-1 flex-col items-center justify-center gap-1"
              >
                {active ? (
                  <motion.span
                    layoutId="dock-lamp"
                    className="absolute inset-x-2 inset-y-1.5 rounded-2xl bg-[rgb(var(--lamp)/0.12)]"
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  >
                    <span className="absolute -top-1.5 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_14px_rgb(var(--lamp)/1)]" />
                  </motion.span>
                ) : null}
                <motion.span whileTap={{ scale: 0.82 }} className="relative flex flex-col items-center gap-1">
                  <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-text-muted")} strokeWidth={1.75} />
                  <span className={cn("text-[10.5px]", active ? "font-semibold text-text-primary" : "text-text-dim")}>{item.label}</span>
                </motion.span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className="relative flex flex-1 flex-col items-center justify-center gap-1"
          >
            {!dockHasActive ? (
              <motion.span layoutId="dock-lamp" className="absolute inset-x-2 inset-y-1.5 rounded-2xl bg-[rgb(var(--lamp)/0.12)]" transition={{ type: "spring", stiffness: 420, damping: 30 }} />
            ) : null}
            <motion.span whileTap={{ scale: 0.82 }} className="relative flex flex-col items-center gap-1">
              {isAuth ? <Avatar user={user} size="sm" /> : <Menu className="h-5 w-5 text-text-muted" strokeWidth={1.75} />}
              <span className="text-[10.5px] text-text-dim">{isAuth ? "You" : "More"}</span>
            </motion.span>
          </button>
        </div>
      </nav>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        groups={groups}
        isAuth={isAuth}
        user={user}
        onLogout={handleLogout}
        onSearch={() => setPaletteOpen(true)}
      />

      {isAuth ? <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
}
