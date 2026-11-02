import { useLayoutEffect, useRef, useState } from "react";
import { useNavigationType } from "react-router-dom";
import useHaunted from "@/components/lamp/useHaunted";
import "./navigation-motion.css";

const publicPaths = new Set(["/", "/events", "/leaderboard", "/gallery", "/contact", "/verify"]);
const isPublic = (path) => publicPaths.has(path) || path.startsWith("/u/");

// Glyphs that streak past the camera while one page dives and the next arrives.
const STREAK = ["∑", "π", "∞", "∫", "φ", "∂", "√", "Δ", "λ", "e", "θ", "ℝ", "∇", "i"];
// The Halloween treatment swaps the maths for things that go bump.
const HAUNTED_STREAK = ["🦇", "👻", "🎃", "🕷️", "💀", "🦇", "🕯️", "👻", "🦇", "🎃", "🕸️", "💀", "🦇", "👻"];
const LENS = "perspective(1600px)";

/** Hinge the 3D move on the middle of what the visitor can see, not the
 * middle of a page that may be many screens tall. */
function originFor(element) {
  if (!element) return "50% 50%";
  const top = element.getBoundingClientRect().top;
  return `50% ${Math.round(window.innerHeight / 2 - top)}px`;
}

/** Retain the outgoing Routes tree for the exit, including for browser POP.
 * No click interception, browser snapshot dependency, or duplicated page trees.
 * Auth/protected routes always render immediately through their existing guards.
 *
 * Every 3D move runs as a Web Animation on #mc-main without fill at rest, so
 * once it finishes or is cancelled no transform, perspective or filter is left
 * on an ancestor of the page (sticky and position:fixed children keep working).
 */
export default function PublicNavigationMotion({ location, children }) {
  const navigationType = useNavigationType();
  const haunted = useHaunted();
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
    const back = navigationType === "POP";
    root.dataset.mcTransition = destination;
    veil.current.dataset.phase = "exit";
    const duration = 300;
    const easing = "cubic-bezier(.22,.7,.2,1)";
    const dive = "cubic-bezier(.55,.05,.7,.25)";
    const arrive = "cubic-bezier(.16,1,.3,1)";

    // The outgoing page tips back and falls away into depth.
    const leaving = content.current?.querySelector("#mc-main");
    const exitOrigin = originFor(leaving);
    const exitAnimation = animate(
      leaving,
      [
        { opacity: 1, transform: `${LENS} translate3d(0, 0, 0) rotateX(0deg)`, transformOrigin: exitOrigin },
        {
          opacity: 0.18,
          transform: `${LENS} translate3d(0, ${back ? 4 : -4}vh, -460px) rotateX(${back ? -14 : 16}deg)`,
          transformOrigin: exitOrigin,
        },
      ],
      { duration, easing: dive, fill: "forwards" },
    );
    animate(veil.current, [{ opacity: 0 }, { opacity: 0.94 }], { duration, easing, fill: "forwards" });
    animate(
      veil.current?.querySelector("svg"),
      [
        { transform: "scale(.62) rotate(-18deg)", opacity: 0 },
        { transform: "scale(1) rotate(0deg)", opacity: 1 },
      ],
      { duration: 360, easing, fill: "forwards" },
    );
    // A streak of glyphs rushes outward past the camera across both phases.
    veil.current?.querySelectorAll(".mc-route-streak > span").forEach((glyph, index, all) => {
      const angle = (index / all.length) * 360 + (index % 3) * 9;
      const reach = 46 + (index % 4) * 9;
      animate(
        glyph,
        [
          { transform: `rotate(${angle}deg) translateX(3vmin) scale(.25)`, opacity: 0 },
          { opacity: 1, offset: 0.35 },
          { transform: `rotate(${angle}deg) translateX(${reach}vmax) scale(1.7)`, opacity: 0 },
        ],
        { duration: 760, delay: (index % 5) * 34, easing: "cubic-bezier(.5,0,.9,.4)", fill: "backwards" },
      );
    });

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
          const origin = originFor(main);
          // The home page keeps its own established entrance.
          const from3d =
            destination === "home"
              ? { opacity: 0, transform: "scale(1.045)" }
              : {
                  opacity: 0,
                  transform: `${LENS} translate3d(0, ${back ? -6 : 6}vh, -680px) rotateX(${back ? 10 : -12}deg)`,
                  transformOrigin: origin,
                };
          const to3d =
            destination === "home"
              ? { opacity: 1, transform: "none" }
              : { opacity: 1, transform: `${LENS} translate3d(0, 0, 0) rotateX(0deg)`, transformOrigin: origin };
          animate(main, [from3d, to3d], { duration: destination === "home" ? 460 : 640, easing: arrive });
          const heading = main.querySelector("h1");
          animate(
            heading,
            [
              { opacity: 0, transform: "translateY(18px)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 380, delay: destination === "leaderboard" ? 90 : 55, fill: "backwards", easing },
          );
          animate(veil.current, [{ opacity: 0.94 }, { opacity: 0 }], { duration: 460, easing, fill: "forwards" });
          animate(
            veil.current?.querySelector("svg"),
            [{ transform: "scale(1) rotate(0deg)" }, { transform: "scale(1.9) rotate(16deg)" }],
            { duration: 460, easing },
          );
          timers.push(window.setTimeout(clear, 700));
        };
        observer = new window.MutationObserver(enter);
        observer.observe(content.current, { childList: true, subtree: true });
        commit();
      }, duration),
    );
    // A slow chunk or render failure must never leave an opaque overlay.
    timers.push(window.setTimeout(clear, 1500));
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
        <div className="mc-route-streak">
          {(haunted ? HAUNTED_STREAK : STREAK).map((glyph, index) => (
            <span key={index}>{glyph}</span>
          ))}
        </div>
      </div>
    </>
  );
}
