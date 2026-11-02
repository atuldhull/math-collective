/**
 * ScrollFx — small scroll-driven moments for the member pages.
 *
 * Each piece owns one ScrollTrigger (scoped with useGSAP, so it is
 * reverted on unmount) and does nothing under reduced motion: content
 * always renders in its final, legible state first and motion is layered
 * on top. Pair with `data-reveal="fog"` (useAutoReveal) for cards that
 * rise out of the fog.
 *
 *   <Parallax speed={18}>        scrubbed drift against the scroll
 *   <Flicker as="h2">            a heading that stutters on like a failing bulb
 *   <ScrollCurve />              an asymptote that draws itself as you scroll
 *   <ScrollCount value={n} />    a number that counts up with the scroll
 *   <FogBank />                  a bank of fog you scroll through between sections
 *
 * ScrollCurve and ScrollCount measure their scroll range from the closest
 * ancestor marked `data-scroll-range` (or themselves), which is what makes
 * a sticky stat count while the list beside it scrolls past.
 */
import { useLayoutEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/cn";

const MOTION = "(prefers-reduced-motion: no-preference)";

// Pages mount inside a route transition (scaled, offset), and data arrives
// later; one debounced refresh after things settle keeps every trigger honest.
let settleCall = null;
function settle() {
  settleCall?.kill();
  settleCall = gsap.delayedCall(1.2, () => ScrollTrigger.refresh());
}

const rangeOf = (el) => el.closest("[data-scroll-range]") || el;

/** Scrubbed vertical drift. Positive speed lags behind the scroll. */
export function Parallax({ as: Tag = "div", speed = 14, className, children, ...rest }) {
  const ref = useRef(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      gsap.fromTo(ref.current, { yPercent: -speed / 2 }, {
        yPercent: speed / 2,
        ease: "none",
        scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: 0.8 },
      });
      settle();
    });
    return () => mm.revert();
  }, { scope: ref, dependencies: [speed] });
  return <Tag ref={ref} className={className} {...rest}>{children}</Tag>;
}

/** A heading that stutters on the first time it scrolls into view. */
export function Flicker({ as: Tag = "h2", className, children, ...rest }) {
  const ref = useRef(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      const el = ref.current;
      const tl = gsap.timeline({ paused: true })
        .set(el, { autoAlpha: 0 })
        .to(el, { autoAlpha: 0.75, duration: 0.05, ease: "none" })
        .to(el, { autoAlpha: 0.08, duration: 0.07, ease: "none" })
        .to(el, { autoAlpha: 0.9, duration: 0.04, ease: "none" }, "+=0.08")
        .to(el, { autoAlpha: 0.25, duration: 0.09, ease: "none" })
        .fromTo(el, { autoAlpha: 0.25, filter: "brightness(2.2) blur(1.5px)" }, { autoAlpha: 1, filter: "brightness(1) blur(0px)", duration: 0.9, ease: "power2.out", clearProps: "opacity,visibility,filter" });
      gsap.set(el, { autoAlpha: 0 });
      let done = false;
      let st = null;
      const fire = () => {
        if (done) return;
        done = true;
        tl.play();
        st?.kill();
      };
      st = ScrollTrigger.create({ trigger: el, start: "clamp(top 90%)", onEnter: fire, onLeave: fire, onEnterBack: fire });
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) fire();
      if (done) st.kill();
      settle();
    });
    return () => mm.revert();
  }, { scope: ref });
  return <Tag ref={ref} className={className} {...rest}>{children}</Tag>;
}

const CURVE = "M6 8 C 46 70, 140 104, 594 112";

/** The signature asymptote, drawn by the scroll across its range. */
export function ScrollCurve({ className, tone = "lamp", start = "top 85%", end = "bottom 45%" }) {
  const ref = useRef(null);
  const color = tone === "violet" ? "rgb(var(--violet))" : "rgb(var(--lamp))";
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      const path = ref.current.querySelector("[data-path]");
      const len = path.getTotalLength();
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: rangeOf(ref.current), start, end, scrub: 0.6 },
      });
      tl.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1 }, 0)
        .fromTo(ref.current.querySelector("[data-asym]"), { scaleX: 0 }, { scaleX: 1, transformOrigin: "left center", duration: 0.8 }, 0)
        .fromTo(ref.current.querySelector("[data-dot]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.9);
      settle();
    });
    return () => mm.revert();
  }, { scope: ref, dependencies: [start, end] });

  return (
    <svg ref={ref} viewBox="0 0 600 122" fill="none" aria-hidden="true" preserveAspectRatio="none" className={cn("block h-16 w-full overflow-visible", className)}>
      <line data-asym x1="0" y1="116" x2="600" y2="116" stroke="rgb(var(--rule))" strokeWidth="1" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
      <path data-path d={CURVE} stroke={color} strokeWidth="1.75" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <circle data-dot cx="594" cy="112" r="3.5" fill={color} />
    </svg>
  );
}

/** A number that counts up as its range scrolls past. Screen readers get
 *  the final value; the animated digits are decorative. */
export function ScrollCount({ value, decimals = 0, prefix = "", suffix = "", className, start = "top 80%", end = "bottom 55%" }) {
  const ref = useRef(null);
  const animating = useRef(false);
  const target = Number(value) || 0;
  const format = (n) => `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;

  // The digits live outside React's text so GSAP can write them; keep
  // them in step with the props whenever the scrub isn't driving them.
  useLayoutEffect(() => {
    if (ref.current && !animating.current) ref.current.textContent = format(target);
  });

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      const el = ref.current;
      animating.current = true;
      const state = { n: 0 };
      el.textContent = format(0);
      gsap.to(state, {
        n: target,
        ease: "none",
        onUpdate: () => { el.textContent = format(state.n); },
        scrollTrigger: { trigger: rangeOf(el), start, end, scrub: 0.5 },
      });
      settle();
      return () => {
        animating.current = false;
        el.textContent = format(target);
      };
    });
    return () => mm.revert();
  }, { scope: ref, dependencies: [target, start, end], revertOnUpdate: true });

  return (
    <span className={className}>
      <span className="sr-only">{format(target)}</span>
      <span ref={ref} aria-hidden="true" className="tabular-nums" />
    </span>
  );
}

/** A bank of fog that rolls sideways as you scroll through it. */
export function FogBank({ className, tone = "ink" }) {
  const ref = useRef(null);
  const tint = tone === "lamp" ? "var(--lamp)" : tone === "violet" ? "var(--violet)" : "var(--color-text-primary)";
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION, () => {
      const layers = ref.current.querySelectorAll("[data-fog-layer]");
      layers.forEach((layer, i) => {
        gsap.fromTo(layer, { xPercent: i % 2 ? 18 : -18, autoAlpha: 0.2 }, {
          xPercent: i % 2 ? -18 : 18,
          autoAlpha: 1,
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: 1 + i * 0.4 },
        });
      });
      settle();
    });
    return () => mm.revert();
  }, { scope: ref });
  return (
    <div ref={ref} aria-hidden="true" className={cn("pointer-events-none relative h-24 overflow-x-clip sm:h-32", className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          data-fog-layer
          className="absolute inset-y-0 -inset-x-1/4"
          style={{
            background: `radial-gradient(ellipse 38% 46% at ${28 + i * 22}% ${45 + (i % 2) * 12}%, rgb(${tint} / ${0.09 - i * 0.02}), transparent 72%)`,
            filter: "blur(18px)",
          }}
        />
      ))}
    </div>
  );
}
