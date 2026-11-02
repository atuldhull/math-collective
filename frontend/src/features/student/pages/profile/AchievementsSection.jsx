import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Loader from "@/components/ui/Loader";
import AchievementBadge from "@/components/ui/AchievementBadge";
import { achievements as achievementsApi } from "@/lib/api";

export default function AchievementsSection() {
  const [allAch, setAllAch] = useState([]);
  const [myAch, setMyAch] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    Promise.all([
      achievementsApi.list().catch(() => ({ data: [] })),
      achievementsApi.mine().catch(() => ({ data: [] })),
    ]).then(([all, mine]) => {
      setAllAch(Array.isArray(all.data) ? all.data : []);
      setMyAch(Array.isArray(mine.data) ? mine.data : []);
      setLoading(false);
    });
  }, []);

  const unlockedIds = new Set(myAch.map(u => u.achievement_id));
  const unlockedCount = unlockedIds.size;
  const totalCount = allAch.length;
  const display = showAll ? allAch : allAch.slice(0, 6);
  const share = totalCount ? unlockedCount / totalCount : 0;

  return (
    <section data-reveal="right" className="lamp-panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg text-text-primary">Achievements</h3>
        <span className="text-[13px] tabular-nums text-text-muted">{unlockedCount} of {totalCount}</span>
      </div>
      {totalCount > 0 && (
        <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-primary transition-transform duration-[1200ms] ease-out"
            style={{ transform: `scaleX(${share})` }}
          />
        </div>
      )}
      {loading ? (
        <div className="mt-4 flex justify-center"><Loader variant="dots" size="sm" /></div>
      ) : allAch.length === 0 ? (
        <p className="mt-3 text-[13px] text-text-dim">No achievements available yet</p>
      ) : (
        <>
          <motion.div layout className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {display.map(ach => (
                <motion.div
                  key={ach.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                >
                  <AchievementBadge
                    achievement={ach}
                    unlocked={unlockedIds.has(ach.id)}
                    compact
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          {totalCount > 6 && (
            <button onClick={() => setShowAll(!showAll)}
              className="mt-3 h-10 w-full rounded-xl text-center text-[13px] font-medium text-primary transition hover:bg-primary/[0.06]">
              {showAll ? "Show less" : `Show all ${totalCount} achievements`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
