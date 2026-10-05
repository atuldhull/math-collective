/**
 * HeroExperience — chooses how much of the hero this device should render.
 *
 * History, because the reasoning matters more than the code here:
 *
 *   rev 1     180-frame Cloudinary image scrub. Laggy and blurry.
 *   rev 2-4   Three.js WebGL Earth with a monument on the surface.
 *   rev 5     "The Infinite Library" — a full Three.js environment.
 *   rev 11    A dispatcher between a pre-rendered video, that Three.js
 *             scene, and a still image, picked by probing for the video.
 *   rev 12    This. All three of those were the same bet — that the way to
 *             look impressive is to render something expensive — and all
 *             three charged the visitor their scroll performance for it.
 *
 * What replaced them is MathFieldHero: parametric curves in SVG, a lattice
 * in CSS gradients, and nothing animating except transform and opacity. It
 * is cheaper than the still image was, because the still image was a 26KB
 * decode and this is a few hundred bytes of path data.
 *
 * The device detection below is kept from rev 11 — it was the good part.
 * It no longer chooses between technologies, only between how much of one
 * composition to draw.
 */

import MathFieldHero from "./MathFieldHero";

/**
 * Should this device get the reduced composition?
 *
 * Reduced means two curves instead of four, no glyph scatter, no cursor
 * tracking. Still the same design — a visitor on a phone should not be able
 * to tell they were served a cheaper version, only that it is smooth.
 *
 * Everything sits behind optional chaining because these APIs are patchily
 * supported and this also runs in tests where navigator is thin.
 */
export function prefersReducedHero() {
  if (typeof window === "undefined") return false;
  try {
    // A phone is composited by a weaker GPU and is the likeliest device to
    // be scrolling past this within the first two seconds.
    if (window.matchMedia?.("(max-width: 767px)").matches) return true;

    const cores = navigator.hardwareConcurrency;
    if (typeof cores === "number" && cores > 0 && cores <= 4) return true;

    const mem = navigator.deviceMemory;
    if (typeof mem === "number" && mem > 0 && mem <= 4) return true;

    // Save-Data is an explicit request not to spend the visitor's resources.
    if (navigator.connection?.saveData) return true;
  } catch {
    /* any of these may be missing; fall through to the full composition */
  }
  return false;
}

export default function HeroExperience() {
  /* Deliberately computed during render rather than in an effect. The old
     dispatcher started in a "detecting" state, painted a placeholder, then
     swapped — a guaranteed extra paint and a visible flash on a slow device.
     These media queries are synchronous and cheap, so the first paint can be
     the right one.

     There is no lazy() here either. Both variants are the same component,
     and it is small enough that a separate chunk would cost more in request
     overhead than it saves in bytes. */
  const variant = prefersReducedHero() ? "reduced" : "full";
  return <MathFieldHero variant={variant} />;
}
