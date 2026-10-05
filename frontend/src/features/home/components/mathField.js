/**
 * mathField — geometry and stylesheet for MathFieldHero.
 *
 * Everything here is computed ONCE at module scope and injected ONCE into
 * the document head. Nothing in this file runs per frame or per render.
 *
 * Why it is shaped this way: the hero it replaces rendered a full Three.js
 * scene with bloom postprocessing every frame, for 500vh of scroll. The
 * replacement's entire per-frame cost is the compositor transforming a
 * handful of already-rasterised layers, which is work the GPU does anyway
 * and the main thread never sees.
 *
 * The composition is built from RADIAL SYMMETRY. The first version used
 * free parametric curves — a Lissajous, a harmonograph — and they were
 * mathematically honest but visually arbitrary: four curves overlapping at
 * unrelated angles reads as tangle, not as design. Everything here is now
 * one motif repeated at equal angles around a centre, which is how a figure
 * gets to look composed rather than scribbled, and is itself a piece of
 * mathematics worth putting on a maths club's front page.
 */

/* ────────────────────────────────────────────────────────────── geometry */

/** Sample a parametric curve into an SVG path string. */
function parametric(fn, steps, precision = 2, turns = 1) {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const [x, y] = fn((i / steps) * Math.PI * 2 * turns);
    pts.push(`${x.toFixed(precision)},${y.toFixed(precision)}`);
  }
  return `M${pts.join("L")}`;
}

/**
 * A rose, r = a·cos(kθ).
 *
 * The petal count is the symmetry: even k gives 2k petals, odd k gives k.
 * Both are exactly rotationally symmetric, which is the property being
 * used here — this is the cheapest way to get a figure that is provably
 * balanced rather than balanced by eye.
 */
function rose(a, k, steps = 720) {
  const odd = k % 2 !== 0;
  return parametric(
    (t) => {
      const r = a * Math.cos(k * t);
      return [r * Math.cos(t), r * Math.sin(t)];
    },
    steps,
    2,
    odd ? 1 : 1
  );
}

/**
 * An epicycloid/hypocycloid — a point on a circle of radius r rolling
 * around a circle of radius R. Integer R/r gives a closed figure with
 * exactly that many cusps, so the symmetry order is chosen, not hoped for.
 *
 * `inner: true` rolls inside (hypocycloid: astroid at 4, deltoid at 3);
 * false rolls outside (epicycloid: cardioid at 1, nephroid at 2).
 */
function cycloid({ R, r, scale = 1, inner = false, steps = 900 }) {
  const k = R / r;
  return parametric(
    (t) =>
      inner
        ? [
            scale * ((R - r) * Math.cos(t) + r * Math.cos((k - 1) * t)),
            scale * ((R - r) * Math.sin(t) - r * Math.sin((k - 1) * t)),
          ]
        : [
            scale * ((R + r) * Math.cos(t) - r * Math.cos((k + 1) * t)),
            scale * ((R + r) * Math.sin(t) + r * Math.sin((k + 1) * t)),
          ],
    steps,
    2,
    1
  );
}

/** A regular n-gon, closed. Pure symmetry, four lines of code. */
function polygon(radius, n, rotate = 0) {
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = rotate + (i / n) * Math.PI * 2;
    pts.push(`${(radius * Math.cos(a)).toFixed(2)},${(radius * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Equally spaced angles — the spokes a motif gets repeated onto. */
export function spokes(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => offset + (i * 360) / n);
}

/**
 * LAYER ONE — visible at the top of the page, fades out as you scroll.
 * A twelve-fold rosette: one lens-shaped petal repeated every 30°.
 */
export const FIGURE_A = Object.freeze({
  symmetry: 12,
  // One petal, drawn pointing up from the origin. Repeating this at twelve
  // equal angles is what produces the symmetry — the petal itself is also
  // mirror-symmetric, so the whole figure has reflection symmetry too.
  petal: "M0,0 C 78,-96 78,-232 0,-330 C -78,-232 -78,-96 0,0",
  rings: [120, 210, 300, 366],
  polygon: polygon(366, 12, -Math.PI / 2),
  inner: rose(150, 6),
});

/**
 * LAYER TWO — crossfades in over the second half of the scroll.
 * Eight-fold, built from cusped roulettes instead of petals, so the figure
 * visibly becomes something ELSE rather than just rotating.
 */
export const FIGURE_B = Object.freeze({
  symmetry: 8,
  // R chosen so the outermost cusp still clears the site header once the
  // scroll scale has grown the figure by its full 22%.
  star: cycloid({ R: 268, r: 33.5, inner: true }), // 8-cusped hypocycloid
  nephroid: cycloid({ R: 128, r: 64, inner: false }), // 2-cusped roulette
  rings: [78, 152, 226],
  polygon: polygon(250, 8, -Math.PI / 2),
  spoke: "M0,-80 L0,-264",
});

/**
 * Glyphs, placed on a ring at equal angles rather than scattered. The
 * scatter was the one asymmetric thing left once the curves were regular,
 * and it read as a mistake next to them.
 */
const GLYPH_CHARS = ["∑", "∫", "φ", "∞", "∇", "∂", "π", "λ"];
export const GLYPHS = Object.freeze(
  GLYPH_CHARS.map((c, i) => {
    const a = (i / GLYPH_CHARS.length) * Math.PI * 2 - Math.PI / 2;
    const R = 430;
    return {
      c,
      x: +(R * Math.cos(a)).toFixed(1),
      y: +(R * Math.sin(a)).toFixed(1),
      s: 30,
      o: 0.15,
    };
  })
);

/* ──────────────────────────────────────────────────────────── stylesheet */

const STYLE_ID = "math-field-hero-styles";

/**
 * Every animated property below is transform or opacity, and nothing else.
 * Those two are the only properties the browser can animate entirely on the
 * compositor — no layout, no paint, no main-thread work per frame. Animating
 * anything else here (width, top, filter, background-position) would put the
 * cost straight back onto the thread that also has to handle scrolling.
 *
 * This is what lets the scroll response be dramatic rather than timid: the
 * figure counter-rotates through 180°, scales by half again, and crossfades
 * into a different figure entirely, and none of it touches the main thread.
 */
const CSS = `
.mf-root {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  /* The hero owns its palette rather than inheriting the theme's.
     Deliberate, and it took a light-mode screenshot to settle: the hero
     headline is white in both themes (it always has been — the WebGL scene
     hard-coded a near-black clear colour and the still frame was a dark
     render), so a hero that followed the theme put white type on a white
     background and the headline vanished.
     A dark hero panel under a light page is the behaviour this site already
     had. Naming the colours here instead of deriving them also means the
     curves cannot be restyled by a token change made for cards or borders
     somewhere else in the app. */
  --mf-ink: 4 6 16;
  --mf-primary: rgb(139 96 255);
  --mf-secondary: rgb(56 200 255);
  --mf-glow: rgb(120 235 255);
  --mf-line: 124 138 196;
  /* Driven from JS. Declared here so the first paint has a value. */
  --mf-px: 0;
  --mf-py: 0;
  --mf-p: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 8%, rgb(139 96 255 / 0.12), transparent 70%),
    radial-gradient(ellipse 70% 50% at 50% 100%, rgb(56 200 255 / 0.09), transparent 70%),
    rgb(var(--mf-ink));
}

/* The coordinate lattice. Two repeating gradients and a mask — no DOM
   nodes, no SVG, and it never animates on its own. A grid built from
   elements would have been hundreds of nodes for the browser to lay out. */
.mf-grid {
  position: absolute;
  inset: -20%;
  background-image:
    repeating-linear-gradient(to right,  rgb(var(--mf-line) / 0.22) 0 1px, transparent 1px 72px),
    repeating-linear-gradient(to bottom, rgb(var(--mf-line) / 0.22) 0 1px, transparent 1px 72px);
  -webkit-mask-image: radial-gradient(ellipse 65% 55% at 50% 45%, #000 20%, transparent 78%);
          mask-image: radial-gradient(ellipse 65% 55% at 50% 45%, #000 20%, transparent 78%);
  will-change: transform;
  /* Drifts the opposite way to the figure, which is what sells the figure
     as sitting in front of a plane rather than painted onto it. */
  transform: translate3d(0, calc(var(--mf-p) * 90px), 0) scale(calc(1 + var(--mf-p) * 0.14));
}

.mf-axis {
  position: absolute;
  background: linear-gradient(var(--mf-axis-dir, to right),
    transparent, rgb(var(--mf-line) / 0.55) 28%, rgb(var(--mf-line) / 0.55) 72%, transparent);
  opacity: calc(1 - var(--mf-p) * 0.85);
}
.mf-axis-x { left: 0; right: 0; top: 45%; height: 1px; }
.mf-axis-y { top: 0; bottom: 0; left: 50%; width: 1px; --mf-axis-dir: to bottom; }

.mf-stage {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  will-change: transform;
  /* The scroll response. One composed transform so the layer is
     composited once rather than nested three deep:
       cursor lean   — small, immediate, makes it feel alive
       scroll rotate — 168°, the movement the long scroll is for
       scroll scale  — opens toward you as you descend. Tried at 0.55 and
                       the figure left the frame by two-thirds of the way
                       down, so the bottom half of the hero was edge
                       fragments. The rotation carries the motion; the
                       scale only needs to add depth to it. */
  transform:
    translate3d(calc(var(--mf-px) * 12px), calc(var(--mf-py) * 12px), 0)
    rotate(calc(var(--mf-p) * 168deg))
    scale(calc(1 + var(--mf-p) * 0.22));
}

.mf-svg { width: min(122vh, 120vw); height: min(122vh, 120vw); overflow: visible; }

.mf-fig { fill: none; stroke-linecap: round; stroke-linejoin: round; }

/* The two figures crossfade across the scroll. A is gone by ~55%, B is
   fully present by ~75%, so the middle of the hero is a genuine transition
   between two different symmetries rather than a dissolve. */
.mf-layer-a { opacity: calc(1 - var(--mf-p) * 1.45); }
.mf-layer-b { opacity: calc((var(--mf-p) - 0.26) * 2.1); }

/* Perpetual motion is rotation only — pure transform, pure compositor.
   Counter-rotating orders so the figure is never static even at the top of
   the page, where --mf-p is 0 and the scroll transform contributes nothing. */
@keyframes mf-spin-cw  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
@keyframes mf-spin-ccw { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }

.mf-rot { transform-box: fill-box; transform-origin: center; }

.mf-root[data-motion="on"] .mf-rot {
  animation: var(--mf-spin, mf-spin-cw) var(--mf-spin-dur, 260s) linear infinite;
}

/* Entrance. A stroke-dashoffset draw-on was the obvious choice and the
   wrong one: dashoffset is not compositor-accelerated, so drawing twelve
   petals plus a star would have put a burst of main-thread work into the
   first second of the page — the exact thing this hero exists to avoid.
   Scale and opacity give the same sense of the figure assembling, and the
   compositor does all of it. */
@keyframes mf-enter {
  from { opacity: 0; transform: scale(0.82); }
  to   { opacity: 1; transform: scale(1); }
}

.mf-root[data-motion="on"] .mf-figures {
  transform-box: fill-box;
  transform-origin: center;
  animation: mf-enter 1.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.mf-glyph {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  fill: rgb(var(--mf-line));
  user-select: none;
}

/* Scrim. The headline sits over the middle of this, and without it the
   type was unreadable against the brighter figure density at centre. */
.mf-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgb(var(--mf-ink) / 0.55) 0%,
    rgb(var(--mf-ink) / 0.25) 28%,
    rgb(var(--mf-ink) / 0.55) 68%,
    rgb(var(--mf-ink) / 0.97) 100%
  );
}

/* ── Stop work that nobody can see ──
   When the hero scrolls out of view the IntersectionObserver clears
   data-visible. Paused animations are not ticked and the layers are not
   re-composited, so a visitor reading the page below pays nothing for a
   hero that is 3000px above them. */
.mf-root[data-visible="false"] .mf-rot,
.mf-root[data-visible="false"] .mf-figures {
  animation-play-state: paused;
}

/* ── Reduced motion ──
   Not "less motion" — none. The composition is designed to stand still:
   figures drawn at full length, nothing rotates, nothing follows the
   cursor, and scroll moves nothing. Someone who asked for this gets a
   static plate, and a symmetrical figure is exactly the kind of thing that
   still works as one. */
@media (prefers-reduced-motion: reduce) {
  .mf-root .mf-rot,
  .mf-root .mf-figures {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  .mf-root .mf-stage,
  .mf-root .mf-grid {
    transform: none !important;
  }
  .mf-root .mf-layer-a { opacity: 1 !important; }
  .mf-root .mf-layer-b { opacity: 0 !important; }
  .mf-root .mf-axis { opacity: 1 !important; }
}
`;

export function ensureMathFieldStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}
