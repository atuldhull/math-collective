/**
 * TreasureHuntSection — the hunt, told as a trail on graph paper.
 *
 * Twenty stops, pinned in a snaking 4-column route on desktop and a
 * simple 2/3-column grid on smaller screens. Motion:
 *   - photos settle onto the paper with a little spin and scale as they
 *     scroll in (GSAP batch),
 *   - on desktop a lamp-lit trail draws itself between the pins, scrubbed
 *     to the scroll, with a glowing traveller riding the tip of the line
 *     (MotionPathPlugin),
 *   - pins light up as the trail reaches them and a sticky counter reads
 *     out the current stop on every screen size,
 *   - the compass in the header turns with the scroll.
 * Reduced motion: everything renders in place, trail fully drawn.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { Flag, Play, Trophy } from "lucide-react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import gsap from "@/lib/gsap-setup";
import { cloudinaryImg } from "@/lib/cloudinary";
import { cn } from "@/lib/cn";

const files = [
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175009/th1_yu7tlg.jpg", type: "img", label: "Start" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175073/th2_m9gf5f.jpg", type: "img", label: "Clue I" },
  { url: "https://res.cloudinary.com/dd0pler5u/video/upload/v1774175545/th3_ddwp6t.mp4", type: "vid", label: "Chase" },
  { url: "https://res.cloudinary.com/dd0pler5u/video/upload/v1774176417/th4_rnyvnq.mp4", type: "vid", label: "Race" },
  { url: "https://res.cloudinary.com/dd0pler5u/video/upload/v1774175073/th5_hwaska.mp4", type: "vid", label: "Sprint" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175075/th6_k25h7p.jpg", type: "img", label: "Clue II" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175075/th7_ozqiy1.jpg", type: "img", label: "Discovery" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175075/th8_ms0yeh.jpg", type: "img", label: "Trail" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175079/th9_rzulny.jpg", type: "img", label: "Clue III" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175081/th10_jdzplq.jpg", type: "img", label: "Deep forest" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175081/th11_erg6vl.jpg", type: "img", label: "The riddle" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175081/th12_ktjb5x.jpg", type: "img", label: "Hidden path" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175083/th13_riqglx.jpg", type: "img", label: "Clue IV" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175093/th14_hyvufj.jpg", type: "img", label: "Almost there" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175084/th15_w4bpxz.jpg", type: "img", label: "Final clue" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175082/th16_cgq33i.jpg", type: "img", label: "The mark" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175082/th17_j56sfy.jpg", type: "img", label: "X marks the spot" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175083/th18_qc2msf.jpg", type: "img", label: "Found it" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175084/th19_k1pfte.jpg", type: "img", label: "Victory" },
  { url: "https://res.cloudinary.com/dd0pler5u/image/upload/v1774175084/th20_l8mobt.jpg", type: "img", label: "Treasure" },
];

const COLS = 4;
// Resting tilt and a little vertical scatter per stop, so the route
// reads as pinned photos rather than a grid.
const ROT = [-2.5, 1.5, -1, 2.2, -1.8, 1, -2.4, 1.6, -0.8, 2, -1.4, 0.6, -2, 1.2, -1.6, 2.4, -0.6, 1.8, -1.2, 0];
const JIT = [0, 28, 6, 36, 14, 0, 30, 10, 34, 4, 22, 0, 8, 30, 0, 24, 18, 2, 30, 12];

function placement(i) {
  const row = Math.floor(i / COLS);
  const k = i % COLS;
  return { row: row + 1, col: row % 2 === 0 ? k + 1 : COLS - k };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function Stop({ file, index, onOpen }) {
  const isLast = index === files.length - 1;
  const isVid = file.type === "vid";
  const { row, col } = placement(index);

  const media = file.type === "img" ? (
    <img
      src={cloudinaryImg(file.url, 520)}
      alt=""
      loading="lazy"
      decoding="async"
      width="400"
      height="300"
      className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-lamp)] group-hover/frame:scale-[1.07]"
    />
  ) : (
    <video controls muted playsInline preload="metadata" className="h-full w-full object-cover" aria-label={file.label}>
      <source src={file.url} type="video/mp4" />
    </video>
  );

  return (
    <li
      data-stop
      data-reached="false"
      className="group/stop relative lg:mt-[var(--j)] lg:[grid-column:var(--c)] lg:[grid-row:var(--r)]"
      style={{ "--r": row, "--c": col, "--j": `${JIT[index]}px` }}
    >
      <div style={{ transform: `rotate(${ROT[index]}deg)` }}>
        <div data-settle className="relative">
          {/* the pin */}
          <span
            data-pin
            aria-hidden="true"
            className={cn(
              "absolute -top-2 left-1/2 z-10 h-4 w-4 -translate-x-1/2 rounded-full border-2 transition-all duration-500",
              "border-[rgb(var(--rule))] bg-panel",
              "group-data-[reached=true]/stop:border-primary group-data-[reached=true]/stop:bg-primary group-data-[reached=true]/stop:shadow-[0_0_14px_rgb(var(--lamp)/0.9)]",
            )}
          />

          <div
            className={cn(
              "group/frame rounded-xl border bg-surface p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] transition-[border-color,box-shadow] duration-500",
              isLast
                ? "border-primary/55 shadow-[0_0_50px_-10px_rgb(var(--lamp)/0.6)]"
                : "border-[rgb(var(--rule))] hover:border-primary/40 group-data-[reached=true]/stop:border-primary/25",
            )}
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-obsidian">
              {file.type === "img" ? (
                <button
                  type="button"
                  onClick={() => onOpen(file.url)}
                  aria-label={`Open photo: ${file.label}`}
                  className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {media}
                </button>
              ) : media}
              {isVid ? (
                <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-obsidian/75 px-2 py-0.5 text-[11px] font-medium text-text-primary backdrop-blur">
                  <Play className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  Video
                </span>
              ) : null}
            </div>
            <p className="flex items-baseline gap-2 px-1.5 pb-0.5 pt-2 text-[13px]">
              <span className={cn("lamp-numerals", isLast ? "text-primary" : "text-text-dim group-data-[reached=true]/stop:text-primary")}>
                {pad(index + 1)}
              </span>
              <span className={cn("truncate font-medium", isLast ? "text-primary" : "text-text-primary")}>{file.label}</span>
              {isLast ? <Trophy className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" /> : null}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}

function Compass() {
  return (
    <svg viewBox="0 0 100 100" fill="none" className="h-full w-full" aria-hidden="true">
      <circle cx="50" cy="50" r="46" stroke="rgb(var(--rule))" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="38" stroke="rgb(var(--lamp)/0.35)" strokeWidth="0.75" strokeDasharray="2 4" />
      <g data-needle style={{ transformOrigin: "50px 50px" }}>
        <polygon points="50,14 45.5,50 54.5,50" fill="rgb(var(--lamp))" />
        <polygon points="50,86 45.5,50 54.5,50" fill="rgb(var(--violet)/0.6)" />
        <circle cx="50" cy="50" r="4" fill="rgb(var(--color-obsidian))" stroke="rgb(var(--lamp))" strokeWidth="1.5" />
      </g>
      <text x="50" y="10" textAnchor="middle" fill="rgb(var(--lamp))" fontSize="8" fontWeight="600">N</text>
    </svg>
  );
}

export default function TreasureHuntSection({ onOpen }) {
  const sectionRef = useRef(null);
  const gridRef = useRef(null);
  const [trail, setTrail] = useState({ d: "", w: 0, h: 0 });

  // Build the trail from the pins' layout positions (offsets ignore the
  // settle transforms, so the line never chases a moving photo).
  const measure = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setTrail((t) => (t.d ? { d: "", w: 0, h: 0 } : t));
      return;
    }
    const stops = Array.from(grid.querySelectorAll("[data-stop]"));
    const pts = stops.map((el) => ({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + 2 }));
    if (pts.length < 2) return;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (Math.abs(a.y - b.y) < 80) {
        // along a row: arc up through the gap above the photos
        const lift = 34 + (i % 3) * 12;
        d += ` Q ${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - lift} ${b.x} ${b.y}`;
      } else {
        // down to the next row: swing out past the edge of the route
        const side = a.x > grid.offsetWidth / 2 ? 1 : -1;
        const out = a.x + side * (stops[0].offsetWidth * 0.62);
        d += ` C ${out} ${a.y + 40} ${out} ${b.y - 40} ${b.x} ${b.y}`;
      }
    }
    const w = grid.offsetWidth;
    const h = grid.offsetHeight;
    setTrail((t) => (t.d === d && t.w === w && t.h === h ? t : { d, w, h }));
  }, []);

  useEffect(() => {
    measure();
    const RO = window.ResizeObserver;
    const ro = RO ? new RO(() => measure()) : null;
    if (ro && gridRef.current) ro.observe(gridRef.current);
    return () => ro?.disconnect();
  }, [measure]);

  // Photos settle onto the paper; the compass turns as you walk.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(sectionRef);
      const cards = q("[data-settle]");
      gsap.set(cards, { autoAlpha: 0, scale: 0.78, y: 50, rotation: (i) => (i % 2 ? 1 : -1) * (7 + (i % 4) * 2.5) });
      ScrollTrigger.batch(cards, {
        start: "top 92%",
        once: true,
        onEnter: (batch) => gsap.to(batch, {
          autoAlpha: 1, scale: 1, y: 0, rotation: 0,
          duration: 1.1, ease: "back.out(1.5)", stagger: 0.08,
          clearProps: "transform,opacity,visibility",
        }),
      });
      gsap.to(q("[data-needle]"), {
        rotation: 300,
        ease: "none",
        scrollTrigger: { trigger: sectionRef.current, start: "top bottom", end: "bottom top", scrub: 1.2 },
      });
    });
    return () => mm.revert();
  }, { scope: sectionRef });

  // Trail, traveller and stop counter, all scrubbed to the scroll.
  // Rebuilt whenever the measured trail changes (resize, breakpoint).
  useGSAP(() => {
    const q = gsap.utils.selector(sectionRef);
    const stops = q("[data-stop]");
    const counterNum = q("[data-counter-num]")[0];
    const counterLabel = q("[data-counter-label]")[0];
    const drawPath = q("[data-trail-draw]")[0];
    const traveller = q("[data-traveller]")[0];

    const setReached = (p) => {
      const n = stops.length;
      const reached = Math.max(1, Math.min(n, Math.floor(p * (n - 1) + 0.0001) + 1));
      stops.forEach((el, i) => { el.dataset.reached = i < reached ? "true" : "false"; });
      if (counterNum) counterNum.textContent = String(reached);
      if (counterLabel) counterLabel.textContent = files[reached - 1].label;
    };

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: gridRef.current,
          start: "top 62%",
          end: "bottom 70%",
          scrub: 0.8,
          onUpdate: (self) => setReached(self.progress),
          onRefresh: (self) => setReached(self.progress),
        },
      });
      if (drawPath) {
        const len = drawPath.getTotalLength();
        gsap.set(drawPath, { strokeDasharray: len, strokeDashoffset: len });
        tl.to(drawPath, { strokeDashoffset: 0, duration: 1 }, 0);
        if (traveller) {
          tl.fromTo(traveller, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.02 }, 0);
          tl.to(traveller, {
            duration: 1,
            motionPath: { path: drawPath, align: drawPath, alignOrigin: [0.5, 0.5] },
          }, 0);
        }
      } else {
        tl.to({}, { duration: 1 }, 0);
      }
    });
    return () => mm.revert();
  }, { scope: sectionRef, dependencies: [trail.d], revertOnUpdate: true });

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hunt-title"
      className="lamp-panel relative mx-auto w-full max-w-[1300px] overflow-clip"
    >
      {/* graph paper */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-60 [background-image:linear-gradient(rgb(var(--rule)/0.55)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--rule)/0.55)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_50%_30%,black_30%,transparent_85%)]"
      />

      <div className="relative px-4 pb-10 pt-8 sm:px-8 sm:pb-14 sm:pt-12 lg:px-12">
        {/* Header */}
        <div className="mb-10 flex items-start justify-between gap-6 sm:mb-14">
          <div className="max-w-xl">
            <h2 id="hunt-title" data-reveal="up" className="lamp-display text-4xl text-text-primary sm:text-5xl">
              Treasure hunt
            </h2>
            <p data-reveal="up" className="mt-3 text-base leading-7 text-text-muted">
              Twenty stops across campus and a riddle at each one. Follow the trail from the first clue to the treasure.
            </p>
          </div>
          <div className="h-16 w-16 shrink-0 sm:h-24 sm:w-24">
            <Compass />
          </div>
        </div>

        {/* Sticky stop counter */}
        <div className="sticky top-20 z-20 -mb-6 flex justify-end motion-reduce:hidden sm:top-24">
          <p
            aria-hidden="true"
            className="inline-flex items-baseline gap-2 rounded-full border border-primary/30 bg-obsidian/80 px-3.5 py-1.5 text-[13px] text-text-muted shadow-[0_8px_30px_-10px_rgb(var(--lamp)/0.5)] backdrop-blur-xl"
          >
            <Flag className="h-3.5 w-3.5 self-center text-primary" strokeWidth={1.75} />
            <span>
              Stop <span data-counter-num className="lamp-numerals text-text-primary">1</span> of {files.length}
            </span>
            <span data-counter-label className="hidden font-medium text-primary sm:inline">{files[0].label}</span>
          </p>
        </div>

        {/* The route */}
        <ol
          ref={gridRef}
          aria-label="Treasure hunt stops, in order"
          className="relative grid grid-cols-2 gap-x-3 gap-y-8 pt-10 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4 lg:gap-x-12 lg:gap-y-24 lg:pt-16"
        >
          {trail.d ? (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 overflow-visible"
              width={trail.w}
              height={trail.h}
              viewBox={`0 0 ${trail.w} ${trail.h}`}
            >
              <defs>
                <linearGradient id="hunt-trail" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--lamp))" />
                  <stop offset="100%" stopColor="rgb(var(--violet))" />
                </linearGradient>
              </defs>
              <path d={trail.d} fill="none" stroke="rgb(var(--rule))" strokeWidth="2" strokeDasharray="6 9" strokeLinecap="round" />
              <path
                data-trail-draw
                d={trail.d}
                fill="none"
                stroke="url(#hunt-trail)"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 6px rgb(var(--lamp)/0.7))" }}
              />
              <g data-traveller className="motion-reduce:hidden" style={{ opacity: 0 }}>
                <circle r="11" fill="rgb(var(--lamp)/0.25)" />
                <circle r="5.5" fill="rgb(var(--lamp))" />
              </g>
            </svg>
          ) : null}

          {files.map((file, i) => (
            <Stop key={file.url} file={file} index={i} onOpen={onOpen} />
          ))}
        </ol>

        {/* End marker */}
        <div data-reveal="scale" className="mt-12 flex justify-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary shadow-[0_0_40px_-12px_rgb(var(--lamp)/0.7)]">
            <Trophy className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Journey complete
          </p>
        </div>
      </div>
    </section>
  );
}
