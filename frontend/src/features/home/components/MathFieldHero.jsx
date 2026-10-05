/**
 * MathFieldHero — the homepage backdrop.
 *
 * Replaces LibraryScene, a 1,545-line Three.js scene that shaded a full
 * environment with bloom postprocessing every frame across 500vh of scroll.
 * That scene was the site's scrolling lag.
 *
 * Two ideas carry the design:
 *
 *   SYMMETRY   Every figure is one motif repeated at equal angles around a
 *              centre. That is what makes it read as composed rather than
 *              scribbled, and it is itself the mathematics — twelve-fold
 *              rosettes, cusped roulettes, regular polygons, concentric
 *              rings.
 *
 *   TRANSFORM  The page has a long hero scroll, so the figure spends it
 *              becoming something else: rotating through 168°, opening
 *              toward the viewer, and crossfading from a twelve-fold
 *              rosette into an eight-fold cusped star.
 *
 * What that costs per frame: nothing on the main thread. Scroll and cursor
 * are written to CSS custom properties, and every property they drive is
 * transform or opacity, which the compositor handles on its own. A React
 * re-render per pointer move would reconcile the whole subtree sixty times
 * a second in order to move one group twelve pixels.
 */

import { useEffect, useRef } from "react";
import {
  FIGURE_A,
  FIGURE_B,
  GLYPHS,
  spokes,
  ensureMathFieldStyles,
} from "./mathField";
import { heroSpanPx } from "@/lib/heroSpan";

/* Spin periods are deliberately unrelated (260/205/340s). Give two groups
   periods with a common factor and the figure visibly re-synchronises every
   few minutes, which reads as a loop; these do not. */
const SPIN_A = { "--mf-spin": "mf-spin-cw", "--mf-spin-dur": "260s" };
const SPIN_B = { "--mf-spin": "mf-spin-ccw", "--mf-spin-dur": "205s" };
const SPIN_C = { "--mf-spin": "mf-spin-cw", "--mf-spin-dur": "340s" };

const PETAL_ANGLES = spokes(FIGURE_A.symmetry);
const STAR_SPOKES = spokes(FIGURE_B.symmetry, 22.5);

/**
 * `full` renders both figures, the glyph ring and the cursor lean.
 * `reduced` drops the glow passes, the finest detail and the glyphs — which
 * is what a low-core phone should be asked to composite. It is not a
 * different design; a visitor should only notice that it is smooth.
 */
export default function MathFieldHero({ variant = "full" }) {
  const rootRef = useRef(null);
  const reduced = variant === "reduced";

  ensureMathFieldStyles();

  /* ── cursor + scroll → CSS custom properties ──────────────────────────
     Both handlers coalesce into a single rAF and write straight to the DOM
     node's style. No state, so no render, so no reconciliation. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // A pointer that cannot hover is a touchscreen; there is no cursor to
    // follow, so the listener would cost battery for nothing.
    const finePointer =
      typeof window !== "undefined" &&
      window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

    let px = 0;
    let py = 0;
    let progress = 0;
    let queued = false;

    const flush = () => {
      queued = false;
      root.style.setProperty("--mf-px", px.toFixed(3));
      root.style.setProperty("--mf-py", py.toFixed(3));
      root.style.setProperty("--mf-p", progress.toFixed(4));
    };

    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(flush);
    };

    const onPointerMove = (e) => {
      // -1..1 from the viewport centre.
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
      schedule();
    };

    /* Scroll progress across the hero's span, from the shared helper so
       this cannot drift from what the overlay and the title use. */
    let span = heroSpanPx();
    const onScroll = () => {
      const next = span > 0 ? Math.min(1, Math.max(0, window.scrollY / span)) : 0;
      // Past the hero the value drives nothing visible, so stop writing it.
      if (next >= 1 && progress >= 1) return;
      progress = next;
      schedule();
    };
    const onResize = () => {
      span = heroSpanPx();
      onScroll();
    };

    if (!prefersReduced) {
      if (finePointer && !reduced) {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
      onScroll();
    }

    /* ── pause when off-screen ──
       The hero is position:fixed, so it never technically leaves the
       viewport. What actually happens is it gets covered by the content
       below. The sentinel is a zero-size marker at the end of the hero's
       scroll span: once it passes, the hero is behind content and every
       frame spent animating it is wasted. */
    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText =
      "position:absolute;top:var(--hero-span);left:0;width:1px;height:1px;pointer-events:none;";
    document.body.appendChild(sentinel);

    let io;
    if (typeof window.IntersectionObserver !== "undefined") {
      io = new window.IntersectionObserver(
        ([entry]) => {
          const stillInHero = entry.boundingClientRect.top > 0;
          root.setAttribute("data-visible", stillInHero ? "true" : "false");
        },
        { threshold: 0 }
      );
      io.observe(sentinel);
    }

    /* The tab being hidden is the same argument as the hero being covered,
       and browsers already throttle rAF there but not CSS animations. */
    const onVisibility = () => {
      if (document.hidden) root.setAttribute("data-visible", "false");
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      sentinel.remove();
    };
  }, [reduced]);

  return (
    <div
      ref={rootRef}
      className="mf-root"
      data-motion="on"
      data-visible="true"
      aria-hidden="true"
    >
      <div className="mf-grid" />
      <div className="mf-axis mf-axis-x" />
      <div className="mf-axis mf-axis-y" />

      <div className="mf-stage">
        <svg
          className="mf-svg"
          viewBox="-500 -500 1000 1000"
          role="presentation"
          focusable="false"
        >
          <g className="mf-figures">
          {/* ── FIGURE A — twelve-fold rosette, present at the top ── */}
          <g className="mf-layer-a">
            <g className="mf-rot" style={SPIN_A}>
              {/* One petal repeated every 30°. Repetition at equal angles is
                  the whole mechanism: the symmetry is constructed, not
                  approximated by eye. */}
              {PETAL_ANGLES.map((a) => (
                <path
                  key={`pa-${a}`}
                  className="mf-fig"
                  d={FIGURE_A.petal}
                  transform={`rotate(${a})`}
                  stroke="var(--mf-primary)"
                  strokeWidth="1.5"
                  opacity="0.72"
                />
              ))}
              {/* A second, wider pass at very low alpha reads as bloom. An
                  SVG filter or a CSS blur would re-rasterise every frame the
                  group rotates; another stroke is just more geometry. */}
              {!reduced &&
                PETAL_ANGLES.map((a) => (
                  <path
                    key={`pg-${a}`}
                    className="mf-fig"
                    d={FIGURE_A.petal}
                    transform={`rotate(${a})`}
                    stroke="var(--mf-primary)"
                    strokeWidth="8"
                    opacity="0.05"
                  />
                ))}
            </g>

            <g className="mf-rot" style={SPIN_B}>
              <path
                className="mf-fig"
                d={FIGURE_A.inner}
                stroke="var(--mf-secondary)"
                strokeWidth="1.15"
                opacity="0.6"
              />
              <path
                className="mf-fig"
                d={FIGURE_A.polygon}
                stroke="var(--mf-glow)"
                strokeWidth="0.7"
                opacity="0.3"
              />
            </g>

            {FIGURE_A.rings.map((r) => (
              <circle
                key={`ra-${r}`}
                className="mf-fig"
                r={r}
                stroke="rgb(var(--mf-line))"
                strokeWidth="0.6"
                opacity="0.22"
              />
            ))}
          </g>

          {/* ── FIGURE B — eight-fold cusped star, arrives on scroll ── */}
          <g className="mf-layer-b">
            <g className="mf-rot" style={SPIN_C}>
              <path
                className="mf-fig"
                d={FIGURE_B.star}
                stroke="var(--mf-secondary)"
                strokeWidth="1.6"
                opacity="0.8"
              />
              {!reduced && (
                <path
                  className="mf-fig"
                  d={FIGURE_B.star}
                  stroke="var(--mf-secondary)"
                  strokeWidth="9"
                  opacity="0.05"
                />
              )}
              {STAR_SPOKES.map((a) => (
                <path
                  key={`sb-${a}`}
                  className="mf-fig"
                  d={FIGURE_B.spoke}
                  transform={`rotate(${a})`}
                  stroke="var(--mf-glow)"
                  strokeWidth="0.7"
                  opacity="0.32"
                />
              ))}
            </g>

            <g className="mf-rot" style={SPIN_A}>
              <path
                className="mf-fig"
                d={FIGURE_B.polygon}
                stroke="var(--mf-primary)"
                strokeWidth="1"
                opacity="0.45"
              />
              {!reduced && (
                <path
                  className="mf-fig"
                  d={FIGURE_B.nephroid}
                  stroke="var(--mf-primary)"
                  strokeWidth="0.9"
                  opacity="0.4"
                />
              )}
            </g>

            {FIGURE_B.rings.map((r) => (
              <circle
                key={`rb-${r}`}
                className="mf-fig"
                r={r}
                stroke="rgb(var(--mf-line))"
                strokeWidth="0.6"
                opacity="0.2"
              />
            ))}
          </g>

          {/* Glyph ring — equal angles, so it belongs to the same symmetry
              as everything else. The original scatter was the one asymmetric
              element and it read as a mistake beside the rest. */}
          {!reduced && (
            <g className="mf-rot" style={SPIN_B}>
              {GLYPHS.map((g) => (
                <text
                  key={g.c}
                  className="mf-glyph"
                  x={g.x}
                  y={g.y}
                  fontSize={g.s}
                  opacity={g.o}
                  textAnchor="middle"
                >
                  {g.c}
                </text>
              ))}
            </g>
          )}
          </g>
        </svg>
      </div>

      <div className="mf-scrim" />
    </div>
  );
}
