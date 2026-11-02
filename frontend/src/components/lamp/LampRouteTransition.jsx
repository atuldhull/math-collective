/**
 * LampRouteTransition — the 3D page swap.
 *
 * The outgoing page tips back into the dark (rotateX, pushed away and
 * blurred) while the incoming page flies forward out of the depth and
 * settles flat. Pairs with WarpOverlay, which streaks glyphs past the
 * camera during the same beat. Wrap it in <AnimatePresence mode="wait">
 * and key it by whatever should trigger a swap.
 *
 * Containing-block hazard: an ancestor with a transform, filter or
 * perspective becomes the containing block for position:fixed
 * descendants, which would pin every page's modals to the page instead
 * of the viewport. So at rest this element must carry none of them:
 * the perspective is folded into the transform and dropped when the
 * transform is identity, and blur is only used on the way out.
 *
 * `variant="fade"` is the layout-level swap (between the student app
 * and a portal, say). It only fades, because the shell it wraps holds
 * the fixed rail and dock.
 */
import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1];

// Each entrance comes from a different direction in 3D; the transition
// director picks one per destination. Exits are quick and plain because
// the director's overlay covers the swap.
const EXIT = { opacity: 0, scale: 0.97, filter: "blur(6px)", transition: { duration: 0.32, ease: [0.7, 0, 0.84, 0] } };
const enter = (from, extra = {}) => ({
  initial: { opacity: 0, ...from },
  enter: {
    opacity: 1, x: 0, y: 0, scale: 1, rotateX: 0, rotateY: 0, rotate: 0,
    transition: { duration: 0.95, ease: EASE, delay: 0.42, ...extra },
  },
  exit: EXIT,
});
const MOTIONS = {
  depth: enter({ scale: 0.86, rotateX: -10, y: 80 }),
  swing: enter({ rotateY: 28, x: 160, scale: 0.94 }),
  zoom: enter({ scale: 1.25 }),
  drop: enter({ y: -140, rotateX: 18, scale: 0.96 }),
  spin: enter({ rotate: -7, scale: 0.8, y: 40 }),
  rise: enter({ y: 160, rotateX: -14 }),
  flip: enter({ rotateX: 75, y: 30 }, { ease: [0.34, 1.56, 0.64, 1] }),
};

const fade = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.45, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.25, ease: "easeIn" } },
};

const withPerspective = (_, generated) =>
  generated === "none" || !generated ? "none" : `perspective(1600px) ${generated}`;

export default function LampRouteTransition({ children, className, variant = "depth" }) {
  const reduced = useReducedMotion();
  const flat = reduced || variant === "fade";
  return (
    <motion.div
      variants={flat ? fade : MOTIONS[variant] || MOTIONS.depth}
      initial="initial"
      animate="enter"
      exit="exit"
      transformTemplate={flat ? undefined : withPerspective}
      style={flat ? undefined : { transformOrigin: variant === "flip" ? "50% 0%" : "50% 30vh" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
