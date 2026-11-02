import { useId } from "react";
import { motion } from "framer-motion";
/**
 * ProfileTabs — horizontal tab switcher for the rich profile page.
 *
 * Currently renders Overview / Achievements / Friends / Activity.
 * Tabs that the viewer isn't allowed to see (e.g. friend list
 * hidden by target's show_friend_list=false) are still rendered
 * as DISABLED tabs — clicking them does nothing visible, but the
 * user can see the section exists. Hiding tabs entirely would
 * create a "why is my layout shifting" surprise.
 *
 * The component is controlled — parent owns the `active` tab id.
 * That's so deep links like /profile/:id?tab=friends (future) can
 * set the initial tab without component-level routing.
 */

const TAB_DEFS = [
  { id: "overview",    label: "Overview",    requires: "canViewProfile" },
  { id: "achievements",label: "Achievements",requires: "canViewProfile" },
  { id: "friends",     label: "Friends",     requires: "canViewFriendList" },
  { id: "activity",    label: "Activity",    requires: "canViewActivityFeed" },
];

/**
 * @param {{
 *   active: string,
 *   onChange: (id: string) => void,
 *   access: { canViewProfile?: boolean, canViewFriendList?: boolean, canViewActivityFeed?: boolean },
 * }} props
 */
export default function ProfileTabs({ active, onChange, access }) {
  // Same lamp slider as the kit SegmentedTabs, but this switcher needs
  // disabled tabs (privacy-gated) and bare labels, so it keeps its own
  // markup.
  const layoutId = useId();
  return (
    <div
      role="tablist"
      aria-label="Profile sections"
      className="scrollbar-none inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-[rgb(var(--rule))] bg-surface/70 p-1 backdrop-blur-xl"
    >
      {TAB_DEFS.map((tab) => {
        const allowed = access?.[tab.requires] !== false;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-disabled={!allowed}
            onClick={() => allowed && onChange(tab.id)}
            className={[
              "relative shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-300",
              isActive
                ? "text-[rgb(var(--color-obsidian))]"
                : allowed
                  ? "text-text-muted hover:text-text-primary"
                  : "cursor-not-allowed text-text-dim/40",
            ].join(" ")}
          >
            {isActive && (
              <motion.span
                aria-hidden
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-primary shadow-[0_6px_24px_-6px_rgb(var(--lamp)/0.6)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-[1]">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
