/**
 * ActivityTab — full paginated timeline of the target's activity.
 *
 * Data: GET /api/users/:id/activity (Phase 3 endpoint, pages of 20
 * merged event-registration + achievement-unlock rows, sorted DESC
 * by timestamp).
 *
 * Privacy: if the target has show_activity_feed=false (and the
 * viewer isn't self), the backend returns `hiddenByUser: true` and
 * we render the "This user has hidden their activity" card.
 *
 * Each row renders via the shared ActivityTimelineItem so the
 * Overview tab preview and this tab look consistent.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import { users } from "@/lib/api";
import { EmptyState } from "@/components/lamp";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import ActivityTimelineItem from "@/components/social/ActivityTimelineItem";

const PAGE_SIZE = 20;

/**
 * @param {{ userId: string }} props
 */
export default function ActivityTab({ userId }) {
  const [items, setItems]         = useState([]);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]     = useState(false);
  const [hidden, setHidden]       = useState(false);
  const timeline = useRef(null);

  // The timeline's spine draws itself as the list scrolls past.
  useGSAP(() => {
    if (!timeline.current) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo("[data-spine]", { scaleY: 0 }, {
        scaleY: 1, ease: "none",
        scrollTrigger: { trigger: timeline.current, start: "top 75%", end: "bottom 60%", scrub: 0.6 },
      });
    });
    return () => mm.revert();
  }, { scope: timeline, dependencies: [items.length, loading], revertOnUpdate: true });

  const fetchPage = useCallback(async (p) => {
    try {
      const { data } = await users.activity(userId, p, PAGE_SIZE);
      setHidden(!!data.hiddenByUser);
      setHasMore(!!data.hasMore);
      setItems((prev) => p === 1 ? (data.items || []) : [...prev, ...(data.items || [])]);
    } catch {
      // Silent — keep prior state.
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setPage(1);
    fetchPage(1).finally(() => setLoading(false));
  }, [userId, fetchPage]);

  const loadMore = async () => {
    setLoadingMore(true);
    const next = page + 1;
    await fetchPage(next);
    setPage(next);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center">
        <Loader variant="dots" size="sm" />
      </div>
    );
  }

  if (hidden) {
    return (
      <EmptyState compact title="This user has hidden their activity" />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState compact title="No activity yet" body="Event check-ins and unlocked achievements will be listed here." />
    );
  }

  return (
    <div className="space-y-3">
      <section ref={timeline} className="lamp-panel relative py-2 pl-7 pr-4 sm:pl-9 sm:pr-6">
        <span aria-hidden="true" className="absolute bottom-4 left-3.5 top-4 w-px bg-[rgb(var(--rule))] sm:left-[1.125rem]" />
        <span
          data-spine
          aria-hidden="true"
          className="absolute bottom-4 left-3.5 top-4 w-px origin-top bg-[linear-gradient(180deg,rgb(var(--lamp)),rgb(var(--violet)))] sm:left-[1.125rem]"
        />
        <div data-stagger="left" className="divide-y divide-[rgb(var(--rule))]">
          {items.map((item, i) => (
            <ActivityTimelineItem key={`${item.kind}-${i}-${item.at}`} item={item} />
          ))}
        </div>
      </section>
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button size="sm" variant="secondary" loading={loadingMore} onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
