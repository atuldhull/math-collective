/**
 * WarpOverlay — the transition director for member route changes.
 *
 * Every destination has its own effect (see transitionEffects.js): a
 * fog iris into the dashboard, glitch slices into the arena, digit rain
 * into problems, doors into roadmaps, a glyph vortex into the
 * leaderboard, a portal or ink bleed from the exact point you clicked,
 * and so on. The effect covers the screen while the old page leaves and
 * uncovers it as the new page flies in on its own 3D motion
 * (LampRouteTransition, variant from the same table).
 *
 * Skipped for reduced-motion users and when leaving the "/" home. A new
 * navigation mid-effect cancels the running one cleanly.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useIsLamplight } from "./SkinProvider";
import { EFFECTS, transitionFor } from "./transitionEffects";
import { HAUNTED_EFFECTS, hauntedEffectFor } from "./hauntedEffects";
import useHaunted from "./useHaunted";

function readTriplet(name, fallback, from = document.documentElement) {
  const raw = window.getComputedStyle(from).getPropertyValue(name).trim();
  return raw ? raw.split(/[\s,]+/).filter(Boolean).slice(0, 3).join(",") : fallback;
}

export default function WarpOverlay({ tree = "member" }) {
  const { pathname } = useLocation();
  const lamplight = useIsLamplight();
  const haunted = useHaunted();
  const canvasRef = useRef(null);
  const layerRef = useRef(null);
  const last = useRef(pathname);
  const pointer = useRef(null);

  // Remember where the click that navigated happened, for effects that
  // start from it (portal, ink).
  useEffect(() => {
    const onDown = (e) => { pointer.current = { x: e.clientX, y: e.clientY, at: performance.now() }; };
    window.addEventListener("pointerdown", onDown, { passive: true, capture: true });
    return () => window.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);

  useEffect(() => {
    if (last.current === pathname) return undefined;
    const from = last.current;
    last.current = pathname;
    // Members: every route but their "/" home. Visitors: only when the
    // Halloween treatment applies (the public tree has its own page swap).
    if (tree === "member" ? !lamplight || from === "/" : !haunted) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    const canvas = canvasRef.current;
    const layer = layerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !layer) return undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { effect, label } = transitionFor(pathname);
    const recent = pointer.current && performance.now() - pointer.current.at < 1500 ? pointer.current : null;
    const source = tree === "public" ? document.querySelector(".mc-public-theme") || document.documentElement : document.documentElement;
    const stage = {
      canvas, ctx, layer, w, h, label,
      origin: recent,
      c: {
        accent: readTriplet("--lamp", "182,160,255", source),
        accent2: readTriplet("--violet", "139,215,237", source),
        fog: readTriplet("--fog", "9,10,14", source),
        ink: readTriplet("--color-text-primary", "242,241,247", source),
        paper: readTriplet("--color-obsidian", "16,17,20", source),
      },
    };

    const run = haunted
      ? HAUNTED_EFFECTS[hauntedEffectFor(pathname)]
      : EFFECTS[effect] || EFFECTS.warp;
    const cleanup = run(stage);
    return () => {
      cleanup?.();
      layer.replaceChildren();
      ctx.clearRect(0, 0, w, h);
    };
    // season is read at navigation time; it must not re-trigger the effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, lamplight]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div ref={layerRef} className="absolute inset-0" />
    </div>
  );
}
