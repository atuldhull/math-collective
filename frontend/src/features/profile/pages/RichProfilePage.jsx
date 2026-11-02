/**
 * RichProfilePage — Phase 15 profile route (/profile/:userId).
 *
 * Fetches the aggregate profile + access flags from
 * GET /api/users/:id/profile and renders:
 *   - ProfileHeader with FriendButton / MessageButton
 *   - ProfileTabs switcher (Overview / Achievements / Friends / Activity)
 *   - Tab content (Phase 8 — currently placeholder)
 *
 * Privacy handling
 * ────────────────
 * When access.canViewProfile is false, the backend already returns a
 * minimal private-card payload (`profile.isPrivate === true`). The
 * header renders the "Private" chip; the tab switcher + tab content
 * disappear entirely — there's nothing to show.
 *
 * Self-detection
 * ──────────────
 * We compare :userId against the logged-in user's id. Matched → the
 * header's "Edit profile" link shows (which points to the legacy
 * /profile route where the self-edit UX lives today); mismatched →
 * the FriendButton + MessageButton show instead.
 *
 * Loading / error states
 * ──────────────────────
 *   - while fetching: centered Loader
 *   - 404 from API: "User not found" card
 *   - other error:   "Couldn't load profile" card with retry
 */

import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/lamp";
import { users, core } from "@/lib/api";
import ProfileHeader from "@/features/profile/components/ProfileHeader";
import ProfileTabs from "@/features/profile/components/ProfileTabs";
import OverviewTab from "@/features/profile/components/OverviewTab";
import AchievementsTab from "@/features/profile/components/AchievementsTab";
import FriendsTab from "@/features/profile/components/FriendsTab";
import ActivityTab from "@/features/profile/components/ActivityTab";

export default function RichProfilePage() {
  const { userId } = useParams();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  // Core-team badge (Council / Head / Core) — null until resolved.
  const [coreBadge, setCoreBadge] = useState(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await users.profile(userId);
      setData(data);
    } catch (err) {
      setError(err?.response?.status === 404 ? "not_found" : "error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Is this user on the club's core team? Best-effort — a failure just
  // means no badge shows.
  useEffect(() => {
    if (!userId) return;
    core.badge(userId).then((r) => setCoreBadge(r.data)).catch(() => setCoreBadge(null));
  }, [userId]);

  // When the target profile is private, force the user back to the
  // Overview-equivalent view — clicking any tab would be a no-op
  // anyway, but this is the safe default.
  useEffect(() => {
    if (data?.access && !data.access.canViewProfile) setActiveTab("overview");
  }, [data]);

  const shell = (content) => (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-16">
      {content}
    </div>
  );

  if (loading) {
    return shell(
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader variant="orbit" size="lg" label="Loading profile..." />
      </div>,
    );
  }

  if (error === "not_found") {
    return shell(
      <EmptyState
        title="User not found"
        body="This profile doesn't exist, or they're not part of your organisation."
      />,
    );
  }

  if (error === "error" || !data) {
    return shell(
      <EmptyState
        title="Couldn't load profile"
        body="Check your connection and try again."
        action={<Button size="sm" variant="secondary" onClick={fetchProfile}>Retry</Button>}
      />,
    );
  }

  const { profile, access } = data;

  return shell(
    <div className="space-y-6">
      <ProfileHeader profile={profile} access={access} userId={userId} coreBadge={coreBadge} />

      {/* Only show tabs + content when the profile is viewable. Private
          profiles end at the header ("This user has a private profile"
          is effectively what the header's Private chip signals). */}
      {access.canViewProfile && (
        <>
          <ProfileTabs active={activeTab} onChange={setActiveTab} access={access} />

          {/* Tab swap: the outgoing panel tips back, the incoming one
              rises off the desk. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              role="tabpanel"
              aria-labelledby={`tab-${activeTab}`}
              initial={{ opacity: 0, y: 18, rotateX: -6 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, y: -10, rotateX: 4 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformPerspective: 1200 }}
            >
              {activeTab === "overview"     && <OverviewTab     userId={userId} access={access} />}
              {activeTab === "achievements" && <AchievementsTab userId={userId} />}
              {activeTab === "friends"      && <FriendsTab      userId={userId} access={access} />}
              {activeTab === "activity"     && <ActivityTab     userId={userId} />}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {/* When access.canViewProfile is false, explicitly show the
          "private" message below the header so the page isn't just a
          bare card. */}
      {!access.canViewProfile && (
        <EmptyState
          compact
          title="This profile is private"
          body="Only the profile owner can view the full page."
        />
      )}
    </div>,
  );
}
