/**
 * PandaMark — PANDA's face drawn as a small chalk-and-ink glyph for the
 * Lamplight skin (the legacy skin keeps the emoji). The eyes blink on a
 * slow, slightly irregular cadence so the launcher feels alive without
 * shouting; reduced-motion users get a still face.
 */
import { motion, useReducedMotion } from "framer-motion";

export default function PandaMark({ size = 32, className, blink = true }) {
  const reduced = useReducedMotion();
  const animateEyes = blink && !reduced;
  const eye = animateEyes
    ? {
        animate: { scaleY: [1, 1, 0.1, 1, 1, 0.1, 1] },
        transition: { duration: 5.2, times: [0, 0.6, 0.63, 0.66, 0.9, 0.93, 0.96], repeat: Infinity },
      }
    : {};

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      {/* ears */}
      <circle cx="9" cy="10" r="5.5" fill="rgb(var(--color-obsidian))" stroke="rgb(var(--color-text-primary))" strokeWidth="1.4" />
      <circle cx="31" cy="10" r="5.5" fill="rgb(var(--color-obsidian))" stroke="rgb(var(--color-text-primary))" strokeWidth="1.4" />
      {/* head */}
      <circle cx="20" cy="22" r="14" fill="rgb(var(--color-text-primary))" />
      {/* eye patches, tilted like the real thing */}
      <ellipse cx="14" cy="20.5" rx="4" ry="5" transform="rotate(-24 14 20.5)" fill="rgb(var(--color-obsidian))" />
      <ellipse cx="26" cy="20.5" rx="4" ry="5" transform="rotate(24 26 20.5)" fill="rgb(var(--color-obsidian))" />
      {/* eyes catch the lamp */}
      <motion.circle cx="14.6" cy="20" r="1.6" fill="rgb(var(--lamp))" style={{ transformOrigin: "14.6px 20px" }} {...eye} />
      <motion.circle cx="25.4" cy="20" r="1.6" fill="rgb(var(--lamp))" style={{ transformOrigin: "25.4px 20px" }} {...eye} />
      {/* nose + mouth */}
      <ellipse cx="20" cy="26.4" rx="2.2" ry="1.5" fill="rgb(var(--color-obsidian))" />
      <path d="M17.6 29.2c1.2 1 3.6 1 4.8 0" stroke="rgb(var(--color-obsidian))" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
