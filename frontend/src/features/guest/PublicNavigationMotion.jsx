import { useLayoutEffect, useRef, useState } from "react";
import { useNavigationType } from "react-router-dom";
import "./navigation-motion.css";

const publicPaths = new Set(["/", "/events", "/leaderboard", "/gallery", "/contact", "/verify"]);
const isPublic = (path) => publicPaths.has(path) || path.startsWith("/u/");

/** Retain the outgoing Routes tree for the exit, including for browser POP.
 * No click interception, browser snapshot dependency, or duplicated page trees.
 * Auth/protected routes always render immediately through their existing guards.
 */
export default function PublicNavigationMotion({ location, children }) {
  const navigationType = useNavigationType();
  const [displayed, setDisplayed] = useState(location);
  const shown = useRef(location);
  const veil = useRef(null);
  const content = useRef(null);
  const eligible = isPublic(shown.current.pathname) && isPublic(location.pathname);
  const rendered = eligible ? displayed : location;

  useLayoutEffect(() => {
    const from = shown.current;
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = [];
    const timers = [];
    let observer;
    let disposed = false;
    const animate = (element, frames, options) => {
      if (!element?.animate) return;
      const animation = element.animate(frames, options);
      animations.push(animation);
      return animation;
    };
    const clear = () => {
      timers.forEach(window.clearTimeout);
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
      root.removeAttribute("data-mc-transition");
      if (veil.current) delete veil.current.dataset.phase;
    };
    const commit = () => {
      if (shown.current.pathname !== location.pathname && navigationType !== "POP") {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
      shown.current = location;
      setDisplayed(location);
    };
    const settle = () => {
      clear();
      commit();
    };
    const changed = from.pathname !== location.pathname;
    if (!changed || !isPublic(from.pathname) || !isPublic(location.pathname) || reduced.matches) {
      commit();
      return clear;
    }

    const destination = location.pathname.slice(1) || "home";
    root.dataset.mcTransition = destination;
    veil.current.dataset.phase = "exit";
    const duration = 240;
    const easing = "cubic-bezier(.22,.7,.2,1)";
    const exitAnimation = animate(
      content.current?.querySelector("#mc-main"),
      [
        { opacity: 1, transform: "none" },
        { opacity: 0.12, transform: "translateY(-14px) scale(.965)" },
      ],
      { duration, easing, fill: "forwards" },
    );
    animate(veil.current, [{ opacity: 0 }, { opacity: 0.96 }], { duration, easing, fill: "forwards" });
    animate(
      veil.current?.querySelector("svg"),
      [
        { transform: "scale(.62) rotate(-18deg)", opacity: 0 },
        { transform: "scale(1) rotate(0deg)", opacity: 1 },
      ],
      { duration: 360, easing, fill: "forwards" },
    );

    timers.push(
      window.setTimeout(() => {
        if (disposed) return;
        veil.current.dataset.phase = "enter";
        // Observe the committed/lazy destination rather than animate its loader.
        const enter = () => {
          const main = content.current?.querySelector("#mc-main");
          if (!main || shown.current !== location || main.dataset.mcRoute !== location.pathname) return;
          observer?.disconnect();
          exitAnimation?.cancel();
          animate(
            main,
            [
              {
                opacity: 0,
                transform: destination === "home" ? "scale(1.045)" : "translateY(24px) scale(.98)",
                clipPath: destination === "gallery" ? "inset(0 8% 12%)" : "inset(3% 0 0)",
              },
              { opacity: 1, transform: "none", clipPath: "inset(0)" },
            ],
            { duration: 460, easing },
          );
          const heading = main.querySelector("h1");
          animate(
            heading,
            [
              { opacity: 0, transform: "translateY(18px)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 380, delay: destination === "leaderboard" ? 90 : 55, fill: "backwards", easing },
          );
          animate(veil.current, [{ opacity: 0.96 }, { opacity: 0 }], { duration: 420, easing, fill: "forwards" });
          animate(
            veil.current?.querySelector("svg"),
            [{ transform: "scale(1) rotate(0deg)" }, { transform: "scale(1.6) rotate(16deg)" }],
            { duration: 420, easing },
          );
          timers.push(window.setTimeout(clear, 480));
        };
        observer = new window.MutationObserver(enter);
        observer.observe(content.current, { childList: true, subtree: true });
        commit();
      }, duration),
    );
    // A slow chunk or render failure must never leave an opaque overlay.
    timers.push(window.setTimeout(clear, 1000));
    const preference = () => {
      if (reduced.matches) settle();
    };
    reduced.addEventListener("change", preference);
    return () => {
      disposed = true;
      clear();
      reduced.removeEventListener("change", preference);
    };
  }, [location, navigationType]);

  return (
    <>
      <div className="mc-route-stage" ref={content}>
        {children(rendered)}
      </div>
      <div className="mc-route-veil" ref={veil} aria-hidden="true">
        <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
          <g className="mc-route-orbit">
            <ellipse cx="500" cy="300" rx="245" ry="145" />
            <ellipse cx="500" cy="300" rx="245" ry="145" transform="rotate(60 500 300)" />
            <ellipse cx="500" cy="300" rx="245" ry="145" transform="rotate(120 500 300)" />
            <path d="M100 300H900M500 20V580" />
            <circle cx="500" cy="300" r="56" />
          </g>
        </svg>
      </div>
    </>
  );
}
