import { lazy, Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { Navigate } from "react-router-dom";
import { useAuthStore, rememberedMember } from "@/store/auth-store";
import MainLayout from "@/layouts/MainLayout";
import AuthLayout from "@/layouts/AuthLayout";
import ExperienceShell from "@/components/experience/ExperienceShell";
import GuestAssistant from "./GuestAssistant";
import HovercardRoot from "@/components/social/HovercardRoot";
import PublicLayout, { PublicAuthLayout } from "./PublicLayout";
import { PublicThemeProvider } from "./PublicTheme";
import { AudioProvider } from "@/systems/AudioManager";

const PublicHome = lazy(() => import("./PublicHome"));
const OriginalGallery = lazy(() => import("@/features/public/pages/GalleryPage"));
const GuestGallery = lazy(() => import("./GuestGallery"));
const OriginalContact = lazy(() => import("@/features/public/pages/ContactPage"));
const GuestContact = lazy(() => import("./GuestContact"));
const OriginalEvents = lazy(() => import("@/features/events/pages/EventsPage"));
const OriginalLeaderboard = lazy(() => import("@/features/public/pages/LeaderboardPage"));
const GuestEvents = lazy(() => import("./GuestEvents"));
const GuestLeaderboard = lazy(() => import("./GuestLeaderboard"));

export function SessionEvents() {
  return useMemberPresentation() ? <OriginalEvents /> : <GuestEvents />;
}
export function SessionLeaderboard() {
  return useMemberPresentation() ? <OriginalLeaderboard /> : <GuestLeaderboard />;
}

export function SessionGallery() {
  return useMemberPresentation() ? <OriginalGallery /> : <GuestGallery />;
}

export function SessionContact() {
  return useMemberPresentation() ? <OriginalContact /> : <GuestContact />;
}

// Presentation only: authentication, guards, redirects and API state stay
// owned by the existing store and router.
//
// Before /auth/me has answered there is no user yet, and answering "guest"
// at that moment is what made a member watch the visitor design for a
// second and then get swapped. While the check is still running, fall back
// to whether this browser last held a session. The server's answer
// overrides it as soon as it lands, so a wrong guess costs nothing worse
// than what used to happen every single time.
export function useMemberPresentation() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  if (user) return true;
  if (status === "idle" || status === "loading") return rememberedMember();
  return false;
}

export function SessionMainLayout() {
  return useMemberPresentation() ? <MainLayout /> : <PublicLayout />;
}

export function SessionAuthLayout() {
  return useMemberPresentation() ? <AuthLayout /> : <PublicAuthLayout />;
}

export function SessionHome() {
  const member = useMemberPresentation();
  // A visitor gets the landing page. A member has no use for it — and the
  // member home was the one screen the redesign never reached — so send
  // them to the dashboard, which is their real home.
  if (member) return <Navigate to="/dashboard" replace />;
  return (
    <Suspense fallback={<div style={{ minHeight: "90vh" }} aria-busy="true" />}>
      <PublicHome />
    </Suspense>
  );
}

export function SessionExperience({ children }) {
  const member = useMemberPresentation();
  if (member)
    return (
      <AudioProvider>
        <ExperienceShell>{children}</ExperienceShell>
      </AudioProvider>
    );
  return (
    <PublicThemeProvider>
      <MotionConfig reducedMotion="user">
        {children}
        <GuestAssistant />
        <HovercardRoot />
      </MotionConfig>
    </PublicThemeProvider>
  );
}
