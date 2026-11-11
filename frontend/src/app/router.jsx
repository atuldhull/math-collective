/**
 * Router composition.
 *
 * Actual route definitions live in `./routes/*Routes.jsx` — this file is
 * pure orchestration: router shell, session bootstrap, scroll management,
 * animated transitions, Suspense fallback.
 */

import { AnimatePresence } from "framer-motion";
import { Suspense, useEffect, useRef } from "react";
import {
  BrowserRouter,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

import { SessionExperience, useMemberPresentation } from "@/features/guest/SessionPresentation";
import PublicNavigationMotion from "@/features/guest/PublicNavigationMotion";
import PageTransition    from "@/components/experience/PageTransition";
import MonumentTransition from "@/components/experience/MonumentTransition";
import MonumentRouter    from "@/components/monument/MonumentRouter";
import Loader            from "@/components/ui/Loader";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import SkinProvider, { skinForPath } from "@/components/lamp/SkinProvider";
import LampRouteTransition from "@/components/lamp/LampRouteTransition";
import WarpOverlay from "@/components/lamp/WarpOverlay";
import SeasonAmbience from "@/components/lamp/SeasonAmbience";
import { useAuthStore }  from "@/store/auth-store";

import { publicRoutes }     from "./routes/publicRoutes";
import { authRoutes }       from "./routes/authRoutes";
import { teacherRoutes }    from "./routes/teacherRoutes";
import { adminRoutes }      from "./routes/adminRoutes";
import { superAdminRoutes } from "./routes/superAdminRoutes";
import { coreTeamRoutes }   from "./routes/coreTeamRoutes";
import { errorRoutes }      from "./routes/errorRoutes";

/**
 * Scroll management — mirrors the SPA behaviour most users expect:
 *   - PUSH     (clicking a link)      -> scroll to top
 *   - REPLACE  (login redirect etc.)  -> scroll to top
 *   - POP      (browser Back/Forward) -> leave scroll alone; the browser
 *     has already restored the saved scroll position for that history entry
 *
 * The navigation type is the reliable signal; the previous unconditional
 * scroll-to-top jumped the user back to the top of long pages when they
 * pressed Back.
 */
function ScrollManager() {
  const { pathname } = useLocation();
  const navType = useNavigationType(); // "PUSH" | "REPLACE" | "POP"
  const lastPath = useRef(pathname);

  useEffect(() => {
    if (lastPath.current === pathname) return; // query-only change
    lastPath.current = pathname;

    if (navType === "POP") return;             // browser restored the scroll

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, navType]);

  return null;
}

/** Triggers the initial /auth/me session check on app mount. */
function SessionLoader({ children }) {
  const checkSession = useAuthStore((s) => s.checkSession);
  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status === "idle") checkSession();
  }, [status, checkSession]);
  return children;
}

/** Shown while a lazy-loaded route chunk is being fetched. */
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader variant="orbit" size="lg" label="Loading..." />
    </div>
  );
}

/**
 * Which layout a path renders inside. Top-level transitions are keyed
 * by this rather than by the full path, so a layout (and its rail and
 * dock) stays mounted while its own pages swap. Page-level transitions
 * and error boundaries live inside AppShell, keyed by the full path.
 * The public home page keeps its original path-keyed transition.
 */
function layoutKey(pathname) {
  if (skinForPath(pathname, true) === "legacy") return pathname;
  const seg = pathname.split("/")[1];
  if (["teacher", "admin", "super-admin", "core"].includes(seg)) return seg;
  if (["login", "signup", "reset-password"].includes(seg)) return "auth";
  return "main";
}

function AnimatedRoutes() {
  const location = useLocation();
  const member = useMemberPresentation();

  // Signed-out visitors get the public tree as it ships upstream, plus
  // the Halloween layer where it applies (useHaunted decides: every page
  // but the home during the season, or anywhere with the Haunted theme).
  if (!member) return (
    <>
    <SeasonAmbience front />
    <WarpOverlay tree="public" />
    <PublicNavigationMotion location={location}>
      {(displayed) => (
        <Suspense fallback={<RouteFallback />}>
          <RouteErrorBoundary key={displayed.pathname}>
            <Routes location={displayed}>
              {publicRoutes}{authRoutes}{teacherRoutes}{adminRoutes}
              {superAdminRoutes}{coreTeamRoutes}{errorRoutes}
            </Routes>
          </RouteErrorBoundary>
        </Suspense>
      )}
    </PublicNavigationMotion>
    </>
  );

  const key = layoutKey(location.pathname);
  const legacy = skinForPath(location.pathname, true) === "legacy";
  const Transition = legacy ? PageTransition : LampRouteTransition;

  return (
    <MonumentRouter>
      <ScrollManager />
      {legacy ? <MonumentTransition /> : null}
      <WarpOverlay />
      <AnimatePresence mode="wait" initial={false}>
        <Transition key={key} variant="fade" className="relative flex min-h-screen flex-1 flex-col">
          <Suspense fallback={<RouteFallback />}>
            {/* Keyed to the layout so it resets when the user moves to
                another layout. Within a layout, AppShell wraps each page
                in its own boundary keyed by pathname, so a crashed
                /arena still clears when the user clicks /dashboard. */}
            <RouteErrorBoundary key={key}>
              <Routes location={location}>
                {publicRoutes}
                {authRoutes}
                {teacherRoutes}
                {adminRoutes}
                {superAdminRoutes}
                {coreTeamRoutes}
                {errorRoutes}
              </Routes>
            </RouteErrorBoundary>
          </Suspense>
        </Transition>
      </AnimatePresence>
    </MonumentRouter>
  );
}

// Vite is configured with base: "/app/" — so the app ships at that path
// both in dev (http://localhost:5173/app/) and in prod (served from the
// backend under /app/*). React Router needs to know this, otherwise it
// tries to match the literal "/app/" path against its route table and
// falls straight through to the 404. Strip the trailing slash because
// basename expects "/app" not "/app/".
const ROUTER_BASENAME = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export default function AppRouter() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <SessionLoader>
        <SkinProvider>
          <SessionExperience>
            <AnimatedRoutes />
          </SessionExperience>
        </SkinProvider>
      </SessionLoader>
    </BrowserRouter>
  );
}
