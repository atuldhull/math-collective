/**
 * AchievementsTab — grid of achievements this user has unlocked.
 *
 * Data: GET /api/achievements/user/:userId (existing endpoint).
 *
 * Layout:
 *   Responsive grid of cards — 2 cols mobile / 3 cols tablet /
 *   4 cols desktop. Each card shows the achievement icon, title,
 *   short description, and when it was unlocked.
 *
 * Rarity → subtle border colour so the legendary + epic ones read
 * as special without shouting. Same palette as
 * ActivityTimelineItem so a user recognises the rarity tier.
 */

import { useEffect, useState } from "react";
import { achievements as achApi } from "@/lib/api";
import { EmptyState, TiltPanel } from "@/components/lamp";
import Loader from "@/components/ui/Loader";

const RARITY_BORDER = {
  common:    "",
  uncommon:  "!border-success/30",
  rare:      "!border-secondary/35",
  epic:      "!border-primary/40",
  legendary: "!border-warning/55",
};

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * @param {{ userId: string }} props
 */
export default function AchievementsTab({ userId }) {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    achApi.user(userId)
      .then((r) => { if (!cancelled) setItems(r.data || []); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center">
        <Loader variant="dots" size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="lamp-panel py-8 text-center text-sm text-danger">
        Couldn&apos;t load achievements.
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        compact
        title="No achievements unlocked yet"
        body="Badges appear here as they are earned at events, in the arena and in live quizzes."
      />
    );
  }

  return (
    <div data-stagger="tilt" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((a) => {
        // The /api/achievements/user/:id endpoint returns rows from
        // user_achievements joined with achievements; the inner shape
        // is either flat (old rows) or nested as `achievements:{...}`.
        const info = a.achievements || a;
        const unlocked = a.unlocked_at || a.created_at;
        const rarity = info.rarity || "common";
        const borderClass = RARITY_BORDER[rarity] || RARITY_BORDER.common;
        return (
          <TiltPanel
            key={a.id || info.slug}
            className={`flex flex-col items-center gap-2 px-3 py-5 text-center ${borderClass}`}
          >
            <div className="relative text-4xl" aria-hidden>{info.icon || "🏅"}</div>
            <p className="relative line-clamp-2 text-sm font-semibold text-text-primary">{info.title}</p>
            {info.description && (
              <p className="relative line-clamp-2 text-[12px] leading-4 text-text-muted">{info.description}</p>
            )}
            <p className="relative mt-auto text-[12px] capitalize text-text-dim">
              {rarity !== "common" ? <span className="mr-2 text-primary">{rarity}</span> : null}
              {formatDate(unlocked)}
            </p>
          </TiltPanel>
        );
      })}
    </div>
  );
}
