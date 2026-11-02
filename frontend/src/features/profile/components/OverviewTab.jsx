/**
 * OverviewTab — landing tab on the rich profile.
 *
 * Shows two sections side-by-side on desktop, stacked on mobile:
 *   1. Mutual friends strip (via MutualFriendsStrip + users.mutualFriends)
 *   2. Recent activity preview (top 5 items via users.activity)
 *
 * This tab deliberately stays LIGHT — full timeline lives in the
 * Activity tab, full friend list in the Friends tab. Overview's
 * job is "give me the gist in one scroll".
 *
 * Empty states are silent: no mutual friends + no activity = the
 * tab just shows a small hint. No big "nothing to show" card —
 * that would make new users feel like there's a problem.
 */

import { useEffect, useState } from "react";
import { users } from "@/lib/api";
import { EmptyState } from "@/components/lamp";
import Loader from "@/components/ui/Loader";
import MutualFriendsStrip from "@/components/social/MutualFriendsStrip";
import ActivityTimelineItem from "@/components/social/ActivityTimelineItem";

/**
 * @param {{
 *   userId: string,
 *   access: { isSelf: boolean, canViewActivityFeed: boolean },
 * }} props
 */
export default function OverviewTab({ userId, access }) {
  const [mutual,   setMutual]   = useState({ mutual: [], count: 0 });
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);

    // Fire both requests in parallel. If activity is gated by
    // show_activity_feed=false (non-self), the backend returns
    // `hiddenByUser:true` with an empty items array — no extra
    // handling needed here.
    Promise.all([
      users.mutualFriends(userId).catch(() => ({ data: { mutual: [], count: 0 } })),
      users.activity(userId, 1, 5).catch(() => ({ data: { items: [] } })),
    ]).then(([mRes, aRes]) => {
      if (cancelled) return;
      setMutual(mRes.data || { mutual: [], count: 0 });
      setActivity(aRes.data?.items || []);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[120px] items-center justify-center">
        <Loader variant="dots" size="sm" />
      </div>
    );
  }

  const showsMutual  = !access.isSelf && mutual.count > 0;
  const showsActivity = activity.length > 0;

  if (!showsMutual && !showsActivity) {
    return (
      <EmptyState
        compact
        title="Nothing to show here yet"
        body="Shared friends and recent activity will collect here as this member takes part."
      />
    );
  }

  return (
    <div data-stagger="up" className="grid gap-4 md:grid-cols-2">
      {/* Mutual friends */}
      {showsMutual && (
        <section className="lamp-panel p-5">
          <h3 className="mb-3 text-lg text-text-primary">
            Mutual friends
          </h3>
          <MutualFriendsStrip mutual={mutual.mutual} count={mutual.count} max={6} />
        </section>
      )}

      {/* Recent activity — always full-width on desktop if mutual is absent */}
      {showsActivity && (
        <section className={`lamp-panel p-5 ${showsMutual ? "" : "md:col-span-2"}`}>
          <h3 className="mb-2 text-lg text-text-primary">
            Recent activity
          </h3>
          <div className="divide-y divide-[rgb(var(--rule))]">
            {activity.map((item, i) => (
              <ActivityTimelineItem key={`${item.kind}-${i}`} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
