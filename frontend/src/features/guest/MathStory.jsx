import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;
const clamp = (n) => Math.max(0, Math.min(1, n));
// Matching sample counts let a single path interpolate between three
// parameterisations. No library, particles, or perpetual animation loop.
const curves = [
  (t) => [Math.cos(t) * 135, Math.sin(t) * 135],
  (t) => [(t / TAU - 0.5) * 370, Math.sin(t) * 100],
  (t) => [Math.sin(t * 3 + Math.PI / 2) * 150, Math.sin(t * 2) * 125],
].map((fn) => Array.from({ length: 161 }, (_, i) => fn((i / 160) * TAU)));
function pathAt(progress) {
  const stage = Math.min(1, Math.floor(progress * 2));
  const mix = clamp(progress * 2 - stage);
  const eased = mix * mix * (3 - 2 * mix);
  return curves[stage]
    .map(([x, y], i) => {
      const next = curves[stage + 1][i];
      return `${i ? "L" : "M"}${(250 + x + (next[0] - x) * eased).toFixed(2)},${(220 + y + (next[1] - y) * eased).toFixed(2)}`;
    })
    .join(" ");
}
const chapters = [
  [
    "01 / THE CIRCLE",
    "Start with a simple idea.",
    "Two coordinates. One parameter. As t changes, (cos t, sin t) traces the circle — the geometry behind periodic motion.",
    "x = cos t · y = sin t",
  ],
  [
    "02 / THE WAVE",
    "Give that idea a dimension.",
    "Unroll time along the horizontal axis. A point moving around a circle becomes a wave: the same rhythm, seen from a different perspective.",
    "x = t · y = sin t",
  ],
  [
    "03 / THE CONNECTION",
    "Let two rhythms meet.",
    "Give each axis its own frequency. A 3:2 ratio creates a Lissajous curve. Simple rules. Unexpected structure. That’s the joy of mathematics.",
    "x = cos 3t · y = sin 2t",
  ],
];

export default function MathStory() {
  const root = useRef(null),
    path = useRef(null),
    glow = useRef(null),
    marker = useRef(null);
  useEffect(() => {
    const element = root.current;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!window.IntersectionObserver || !window.ResizeObserver) return;
    let visible = false,
      frame = 0,
      top = 0,
      travel = 1;
    const render = () => {
      frame = 0;
      if (!visible || document.hidden) return;
      const progress = media.matches ? 0 : clamp((window.scrollY - top) / travel);
      const d = pathAt(progress);
      path.current.setAttribute("d", d);
      glow.current.setAttribute("d", d);
      element.style.setProperty("--mc-story-scale", String(1 + Math.sin(progress * Math.PI) * 0.12));
      element.style.setProperty("--mc-story-turn", `${Math.sin(progress * Math.PI * 2) * 7}deg`);
      element.style.setProperty("--mc-story-progress", String(progress));
      marker.current.textContent = media.matches
        ? "STATIC VIEW · REDUCED MOTION"
        : `TRANSFORMATION / ${Math.round(progress * 100)
            .toString()
            .padStart(3, "0")}%`;
    };
    const schedule = () => {
      if (visible && !frame && !document.hidden) frame = requestAnimationFrame(render);
    };
    const measure = () => {
      const rect = element.getBoundingClientRect();
      top = rect.top + window.scrollY;
      travel = Math.max(1, rect.height - window.innerHeight);
      schedule();
    };
    const observer = new window.IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        measure();
        schedule();
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    const resize = new window.ResizeObserver(measure);
    observer.observe(element);
    resize.observe(element);
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else schedule();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", schedule);
    };
  }, []);
  return (
    <section className="mc-math-story" ref={root} aria-label="From a circle to a connection">
      <div className="mc-story-visual">
        <p className="mc-eyebrow">
          <span className="mc-dot" /> THE SHAPE OF AN IDEA
        </p>
        <div className="mc-curve-stage">
          <svg
            viewBox="0 0 500 440"
            role="img"
            aria-label="A parametric curve transforming from a circle through a sine wave into a Lissajous figure as you scroll"
          >
            <defs>
              <pattern id="mc-coordinate-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0H0V40" fill="none" stroke="currentColor" strokeWidth=".5" />
              </pattern>
            </defs>
            <rect
              className="mc-coordinate-grid"
              x="10"
              y="20"
              width="480"
              height="400"
              fill="url(#mc-coordinate-grid)"
            />
            <path className="mc-coordinate-axis" d="M20 220H480M250 30V410" />
            <circle cx="250" cy="220" r="185" className="mc-coordinate-orbit" />
            <path ref={glow} d={pathAt(0)} className="mc-curve-glow" />
            <path ref={path} d={pathAt(0)} className="mc-curve-path" />
            <text x="467" y="241">
              x
            </text>
            <text x="263" y="42">
              y
            </text>
            <text x="260" y="240">
              0
            </text>
          </svg>
        </div>
        <div className="mc-story-meter">
          <span ref={marker}>TRANSFORMATION / 000%</span>
          <span>SCROLL TO TRANSFORM ↓</span>
        </div>
        <div className="mc-story-progress" aria-hidden="true">
          <span />
        </div>
      </div>
      <div className="mc-story-chapters">
        {chapters.map(([label, title, text, formula]) => (
          <article key={label}>
            <p className="mc-eyebrow">{label}</p>
            <h2>{title}</h2>
            <p>{text}</p>
            <code>{formula}</code>
          </article>
        ))}
      </div>
    </section>
  );
}
