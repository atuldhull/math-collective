/**
 * AchievementBadge — displays an achievement with rarity glow.
 *
 * Uses the achievement-* CSS classes from theme.css.
 * Rarity tiers: common, uncommon, rare, epic, legendary.
 *
 * memo (Phase 13) — list-rendered across the achievements grid on the
 * profile + dashboard pages. The `achievement` prop arrives from the
 * achievements store (Zustand) which holds stable object references
 * until the row mutates, so shallow compare on { achievement,
 * unlocked, compact, className } correctly hits.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { Award, Check, Lock } from "lucide-react";
import { useIsLamplight } from "@/components/lamp/SkinProvider";

const LAMP_RARITY = {
  common:    { label: "Common",    text: "text-text-muted", ring: "border-[rgb(var(--rule))]" },
  uncommon:  { label: "Uncommon",  text: "text-success",    ring: "border-success/35" },
  rare:      { label: "Rare",      text: "text-secondary",  ring: "border-secondary/45" },
  epic:      { label: "Epic",      text: "text-primary",    ring: "border-[rgb(var(--lamp)/0.45)]" },
  legendary: { label: "Legendary", text: "text-warning",    ring: "border-warning/60 shadow-[0_0_30px_-12px_rgb(var(--lamp)/0.8)]" },
};

function AchievementBadge({ achievement, unlocked = false, compact = false, className = "" }) {
  const lamp = useIsLamplight();
  if (!achievement) return null;
  if (lamp) return <LampBadge achievement={achievement} unlocked={unlocked} compact={compact} className={className} />;

  const { icon, title, description, rarity = "common", xp_reward } = achievement;

  return (
    <motion.div
      whileHover={unlocked ? { scale: 1.03, y: -2 } : undefined}
      className={`achievement-badge achievement-${rarity} rounded-xl p-3 ${
        unlocked ? "" : "opacity-40 grayscale"
      } ${className}`}
      style={{ clipPath: "var(--clip-notch)" }}
    >
      <div className="flex items-center gap-3">
        <span className={`${compact ? "text-xl" : "text-3xl"} flex-shrink-0`}>{icon || "🏅"}</span>
        <div className="min-w-0 flex-1">
          <p className={`font-display font-bold text-white ${compact ? "text-xs" : "text-sm"}`}>
            {title}
          </p>
          {!compact && description && (
            <p className="mt-0.5 text-[11px] text-text-muted leading-snug">{description}</p>
          )}
        </div>
        {xp_reward > 0 && (
          <span className="math-text text-[11px] font-bold text-primary flex-shrink-0">
            +{xp_reward}
          </span>
        )}
      </div>
      {!compact && (
        <div className="mt-2 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider ${
            rarity === "legendary" ? "bg-warning/15 text-warning" :
            rarity === "epic" ? "bg-primary/15 text-primary" :
            rarity === "rare" ? "bg-secondary/15 text-secondary" :
            rarity === "uncommon" ? "bg-success/15 text-success" :
            "bg-text-dim/10 text-text-dim"
          }`}>
            {rarity}
          </span>
          {unlocked && (
            <span className="font-mono text-[8px] text-success uppercase tracking-wider">Unlocked</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default memo(AchievementBadge);

// Lamplight: a medal tile on the desk. Locked badges sit in shadow with a
// lock; unlocked ones lift and catch the lamp. Legendary carries a glow.
function LampBadge({ achievement, unlocked, compact, className }) {
  const { icon, title, description, rarity = "common", xp_reward } = achievement;
  const r = LAMP_RARITY[rarity] || LAMP_RARITY.common;
  return (
    <motion.div
      whileHover={unlocked ? { y: -3, rotateX: 4 } : undefined}
      transition={{ type: "spring", stiffness: 380, damping: 24 }}
      className={`relative rounded-2xl border bg-surface/60 ${compact ? "p-2.5" : "p-3.5"} ${unlocked ? r.ring : "border-[rgb(var(--rule))] opacity-55 saturate-0"} ${className}`}
      style={{ transformPerspective: 600 }}
    >
      <div className="flex items-center gap-3">
        <span
          className={`relative grid shrink-0 place-items-center rounded-xl border border-[rgb(var(--rule))] bg-[rgb(var(--color-obsidian)/0.5)] ${compact ? "h-9 w-9 text-lg" : "h-12 w-12 text-2xl"}`}
        >
          {icon || <Award className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden="true" />}
          {!unlocked && (
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-[rgb(var(--rule))] bg-surface text-text-dim">
              <Lock className="h-3 w-3" strokeWidth={2} aria-label="Locked" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-text-primary ${compact ? "text-[13px]" : "text-sm"}`}>{title}</p>
          {!compact && description && (
            <p className="mt-0.5 text-[12px] leading-snug text-text-muted">{description}</p>
          )}
        </div>
        {xp_reward > 0 && (
          <span className="lamp-numerals shrink-0 text-[12px] text-primary">+{xp_reward} XP</span>
        )}
      </div>
      {!compact && (
        <div className="mt-2.5 flex items-center gap-2 text-[12px] font-medium">
          <span className={r.text}>{r.label}</span>
          {unlocked && (
            <span className="inline-flex items-center gap-1 text-success">
              <Check className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
              Unlocked
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
