/**
 * useAutoReveal — scroll-in choreography for everything inside a root.
 *
 * Pages mark elements with `data-reveal` (optionally "up" | "fade" |
 * "scale" | "left" | "right" | "tilt" | "fog"), or mark a container with
 * `data-stagger` to reveal each of its children. Elements that arrive
 * later (data fetched after mount) are picked up by a MutationObserver,
 * so pages never have to re-trigger anything when their lists load.
 *
 * Elements entering the viewport in the same frame are revealed as one
 * staggered GSAP batch, which is what makes grids cascade.
 */
import { useEffect } from "react";
import gsap from "@/lib/gsap-setup";

const FROM = {
  up:    { y: 36, autoAlpha: 0 },
  fade:  { autoAlpha: 0 },
  scale: { scale: 0.92, y: 18, autoAlpha: 0 },
  left:  { x: -40, autoAlpha: 0 },
  right: { x: 40, autoAlpha: 0 },
  tilt:  { rotateX: -14, y: 44, transformPerspective: 900, transformOrigin: "50% 100%", autoAlpha: 0 },
  // Rises out of a fog bank: low, faint and blurred, then sharpens.
  fog:   { y: 64, scale: 0.96, autoAlpha: 0, filter: "blur(14px)" },
};

const SELECTOR = "[data-reveal]:not([data-revealed]), [data-stagger] > :not([data-revealed])";

function variantOf(el) {
  const own = el.getAttribute("data-reveal");
  if (own && FROM[own]) return own;
  const parent = el.parentElement?.getAttribute("data-stagger");
  return parent && FROM[parent] ? parent : "up";
}

export default function useAutoReveal(rootRef, enabled = true) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return undefined;
    if (typeof IntersectionObserver === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let pending = [];
    let frame = 0;

    const flush = () => {
      frame = 0;
      const batch = pending.sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
          || a.getBoundingClientRect().left - b.getBoundingClientRect().left,
      );
      pending = [];
      gsap.to(batch, {
        x: 0, y: 0, scale: 1, rotateX: 0, autoAlpha: 1, filter: "blur(0px)",
        duration: 1.05,
        ease: "expo.out",
        stagger: { each: 0.075, from: "start" },
        overwrite: "auto",
        clearProps: "transform,opacity,visibility,filter",
      });
    };

    const io = new window.IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        pending.push(entry.target);
      }
      if (pending.length && !frame) frame = requestAnimationFrame(flush);
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.01 });

    const arm = (scope) => {
      const nodes = scope.querySelectorAll ? scope.querySelectorAll(SELECTOR) : [];
      nodes.forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        el.setAttribute("data-revealed", "");
        gsap.set(el, FROM[variantOf(el)]);
        io.observe(el);
      });
    };

    arm(root);
    // Live pages (quiz timers, chat) mutate constantly; re-scan at most
    // once per frame rather than once per mutation record.
    let armFrame = 0;
    const mo = new window.MutationObserver((records) => {
      if (armFrame) return;
      if (!records.some((r) => r.addedNodes.length)) return;
      armFrame = requestAnimationFrame(() => { armFrame = 0; arm(root); });
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
      if (frame) cancelAnimationFrame(frame);
      if (armFrame) cancelAnimationFrame(armFrame);
      pending = [];
    };
  }, [rootRef, enabled]);
}
