/**
 * AsymptoteCurve — the skin's signature mark.
 *
 * A y = 1/x style curve sliding toward a dashed asymptote. It draws
 * itself once on mount and a lamp dot rides the curve toward the line
 * it can approach but never meet. `progress` (0..1) parks the dot at a
 * point along the curve instead of looping, which turns the mark into
 * a progress meter (XP toward the next level, a sprint toward its end).
 * Later changes to `progress` only glide the dot; the curve is not
 * redrawn, so live meters stay calm.
 */
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";

const CURVE = "M4 4 C 30 52, 90 70, 296 74";

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function AsymptoteCurve({ className, progress, tone = "lamp", delay = 0.2 }) {
  const root = useRef(null);
  const state = useRef({ t: 0 });
  const color = tone === "violet" ? "rgb(var(--violet))" : "rgb(var(--lamp))";
  const target = typeof progress === "number" ? clamp01(progress) : null;
  const isMeter = target !== null;

  const place = () => {
    const path = root.current?.querySelector("[data-path]");
    const dot = root.current?.querySelector("[data-dot]");
    if (!path || !dot) return;
    const p = path.getPointAtLength(path.getTotalLength() * state.current.t);
    dot.setAttribute("cx", p.x);
    dot.setAttribute("cy", p.y);
  };

  // The entrance: draw the curve and the asymptote, then either park the
  // dot at `progress` or set it looping toward the line.
  useGSAP(() => {
    const path = root.current.querySelector("[data-path]");
    const dot = root.current.querySelector("[data-dot]");
    const len = path.getTotalLength();

    if (reducedMotion()) {
      state.current.t = target ?? 1;
      place();
      return;
    }

    const tl = gsap.timeline({ delay });
    tl.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.6, ease: "expo.out" })
      .fromTo(root.current.querySelector("[data-asym]"), { scaleX: 0 }, { scaleX: 1, transformOrigin: "left center", duration: 1.2, ease: "expo.out" }, 0.1)
      .fromTo(dot, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.5);

    if (isMeter) {
      tl.to(state.current, { t: target, duration: 1.8, ease: "power3.out", onUpdate: place }, 0.4);
    } else {
      tl.to(state.current, { t: 0.985, duration: 3.6, ease: "power2.out", onUpdate: place, repeat: -1, repeatDelay: 1.2 }, 0.4);
    }
  }, { scope: root, dependencies: [isMeter], revertOnUpdate: true });

  // Progress updates after the entrance: glide the dot only.
  useGSAP(() => {
    if (!isMeter || state.current.t === 0) return;
    if (reducedMotion()) {
      state.current.t = target;
      place();
      return;
    }
    gsap.to(state.current, { t: target, duration: 0.9, ease: "power3.out", onUpdate: place, overwrite: true });
  }, { scope: root, dependencies: [target] });

  return (
    <svg ref={root} viewBox="0 0 300 80" fill="none" aria-hidden="true" className={cn("overflow-visible", className)}>
      <line data-asym x1="0" y1="78" x2="300" y2="78" stroke="rgb(var(--rule))" strokeWidth="1.2" strokeDasharray="4 6" />
      <path data-path d={CURVE} stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle data-dot r="4.5" cx="4" cy="4" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
    </svg>
  );
}
