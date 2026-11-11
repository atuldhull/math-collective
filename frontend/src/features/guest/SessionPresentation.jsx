/**
 * One presentation for everyone.
 *
 * This module used to pick between two different designs depending on
 * whether the auth store held a user: members got the app, signed-out
 * visitors got a separate public site. That split caused three problems
 * and no longer earns its keep:
 *
 *   - visitors and members saw different sites, which was not wanted;
 *   - the app painted the visitor design before /auth/me resolved, so a
 *     member watched it flip a second later on every load;
 *   - any non-ignored 401 clears the auth store, which silently repainted
 *     a signed-in member into the visitor design mid-browse.
 *
 * Everything below now renders the same thing for everyone. Access is
 * unchanged: the route guards still decide what a visitor may open, and
 * they redirect to sign-in exactly as before. This is presentation only.
 */
import { lazy } from "react";
import { useAuthStore } from "@/store/auth-store";
import MainLayout from "@/layouts/MainLayout";
import AuthLayout from "@/layouts/AuthLayout";
import ExperienceShell from "@/components/experience/ExperienceShell";
import { AudioProvider } from "@/systems/AudioManager";

const GalleryPage = lazy(() => import("@/features/public/pages/GalleryPage"));
const ContactPage = lazy(() => import("@/features/public/pages/ContactPage"));
const EventsPage = lazy(() => import("@/features/events/pages/EventsPage"));
const LeaderboardPage = lazy(() => import("@/features/public/pages/LeaderboardPage"));

/** Whether a member session is actually present. Kept for callers that
 *  need the real answer — it no longer decides which design is shown. */
export function useMemberPresentation() {
  return useAuthStore((state) => Boolean(state.user));
}

export function SessionMainLayout() {
  return <MainLayout />;
}

export function SessionAuthLayout() {
  return <AuthLayout />;
}

export function SessionEvents() {
  return <EventsPage />;
}

export function SessionLeaderboard() {
  return <LeaderboardPage />;
}

export function SessionGallery() {
  return <GalleryPage />;
}

export function SessionContact() {
  return <ContactPage />;
}

export function SessionExperience({ children }) {
  return (
    <AudioProvider>
      <ExperienceShell>{children}</ExperienceShell>
    </AudioProvider>
  );
}
