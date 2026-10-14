import { lazy, Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import MainLayout from "@/layouts/MainLayout";
import AuthLayout from "@/layouts/AuthLayout";
import ExperienceShell from "@/components/experience/ExperienceShell";
import GuestAssistant from "./GuestAssistant";
import HovercardRoot from "@/components/social/HovercardRoot";
import PublicLayout, { PublicAuthLayout } from "./PublicLayout";
import { PublicThemeProvider } from "./PublicTheme";
import { AudioProvider } from "@/systems/AudioManager";

const OriginalHome = lazy(() => import("@/features/home/pages/HomePage"));
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
// owned by the existing store and router. A retained user also protects the
// original interface during session refreshes.
export function useMemberPresentation() {
  return useAuthStore((state) => Boolean(state.user));
}

export function SessionMainLayout() {
  return useMemberPresentation() ? <MainLayout /> : <PublicLayout />;
}

export function SessionAuthLayout() {
  return useMemberPresentation() ? <AuthLayout /> : <PublicAuthLayout />;
}

export function SessionHome() {
  const member = useMemberPresentation();
  return (
    <Suspense fallback={<div style={{ minHeight: "90vh" }} aria-busy="true" />}>
      {member ? <OriginalHome /> : <PublicHome />}
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
