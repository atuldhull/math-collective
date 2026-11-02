/**
 * WorldIntro — a long, scroll-driven descent into a page's world.
 *
 * The section is several screens tall; a sticky stage inside it holds a
 * 3D field of glyphs and frames. Scrolling flies a camera forward
 * through the field: things swell out of the dark, rush past and vanish
 * behind you while the page's story plays in chapters ("beats"), and a
 * lit portal opens at the end, handing the visitor down into the page.
 *
 * Works in both trees. Colours resolve from the public tree's --mc-*
 * tokens when present (features/guest), otherwise from the member skin.
 *
 * The stage uses position:sticky (not a GSAP pin) so it keeps working
 * inside page transitions. Never wrap it in overflow:hidden/auto.
 *
 * Props
 *   beats   [{ kicker?, title, body? }]  2–4 chapters, first is the hero.
 *           Wrap one word in *asterisks* for the Georgia-italic accent.
 *   glyphs  strings scattered through the field
 *   frames  [{ src?, label? }]            floating panels: photos or text
 *   length  section height in viewports (default 4.2)
 *   mood    "lit" (default) | "spooky": fog banks, flickering glyphs,
 *           far-off lightning, a vignette that closes as you descend
 *   inset   "shell" (inside the member AppShell, clears its rail) |
 *           "full" (any full-width layout, e.g. the public pages)
 *   cta     node shown with the final beat
 *   skipLabel  text for the skip control ("Skip intro")
 */
import { useMemo, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import useHaunted from "./useHaunted";

// The Halloween treatment fills the corridor with these instead of maths.
const HALLOWEEN = ["🦇", "👻", "🎃", "🕷️", "💀", "🕸️", "🕯️", "🌕", "🦇", "⚰️", "🧛", "🦇", "👁️", "🪦"];

const DEPTH = 5200;

const VARS = {
  "--wi-accent": "var(--mc-accent, rgb(var(--lamp, 182 160 255)))",
  "--wi-accent-2": "var(--mc-accent-2, rgb(var(--violet, 139 215 237)))",
  "--wi-ink": "var(--mc-ink, rgb(var(--color-text-primary)))",
  "--wi-muted": "var(--mc-muted, rgb(var(--color-text-muted)))",
  "--wi-paper": "var(--mc-paper, rgb(var(--color-obsidian)))",
  "--wi-line": "var(--mc-line, rgb(var(--rule, 52 55 66)))",
  "--wi-fog": "var(--mc-deep, rgb(var(--fog, 9 10 14)))",
};
// Spooky worlds paint their stage with the fog colour, which is dark
// even on light themes, so text and accent switch to fog-safe values.
const SPOOKY_VARS = {
  "--wi-accent": "var(--mc-deep-accent, rgb(var(--fog-accent, 182 160 255)))",
  "--wi-ink": "var(--mc-deep-ink, rgb(var(--fog-ink, 242 241 247)))",
  "--wi-muted": "var(--mc-deep-muted, rgb(var(--fog-muted, 167 170 184)))",
  "--wi-paper": "var(--wi-fog)",
};
const mix = (v, pct) => `color-mix(in srgb, var(${v}) ${pct}%, transparent)`;

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Splits a title into masked words; *word* becomes the italic accent. */
function Words({ text }) {
  return text.split(" ").map((raw, i, all) => {
    const accent = /^\*.+\*[.,!?]*$/.test(raw);
    const word = accent ? raw.replace(/\*/g, "") : raw;
    return (
      <span key={`${raw}-${i}`} className="lamp-word">
        <span
          data-beat-word
          className={accent ? "font-['Georgia',serif] font-normal italic" : undefined}
          style={accent ? { color: "var(--wi-accent)" } : undefined}
        >
          {word}{i < all.length - 1 ? " " : ""}
        </span>
      </span>
    );
  });
}

export default function WorldIntro({
  beats,
  glyphs = ["∑", "∫", "π", "∞", "√2", "∂", "λ", "φ", "e", "Δ", "∇", "i²", "0", "1", "ℝ"],
  frames = [],
  length = 4.2,
  mood = "lit",
  inset = "shell",
  cta,
  skipLabel = "Skip intro",
  className,
}) {
  const root = useRef(null);
  const haunted = useHaunted();
  const spooky = mood === "spooky" || haunted;
  const fieldGlyphs = haunted ? HALLOWEEN : glyphs;
  const seedKey = beats.map((b) => b.title).join("|");

  const field = useMemo(() => {
    const rand = seeded(hash(seedKey));
    // Colour emoji are slow to rasterise at size, so the haunted field is
    // sparser and smaller than the maths one.
    const count = haunted ? 22 : 46;
    const glyphItems = Array.from({ length: count }, (_, i) => {
      const angle = rand() * Math.PI * 2;
      const radius = 260 + rand() * 900;
      return {
        kind: "glyph",
        text: fieldGlyphs[i % fieldGlyphs.length],
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius * 0.62,
        z: 300 + (i / count) * (DEPTH - 500) + rand() * 120,
        size: haunted ? 40 + rand() * 56 : 44 + rand() * 120,
        tone: rand() < 0.55 ? "a" : rand() < 0.6 ? "b" : "ink",
        spin: (rand() - 0.5) * 40,
        flicker: rand() < 0.35,
      };
    });
    const frameItems = frames.slice(0, 12).map((f, i, all) => {
      const side = i % 2 === 0 ? -1 : 1;
      return {
        kind: "frame",
        ...f,
        x: side * (300 + rand() * 260),
        y: (rand() - 0.5) * 360,
        z: 700 + (i / Math.max(1, all.length)) * (DEPTH - 1500),
        tilt: side * (14 + rand() * 12),
      };
    });
    return [...glyphItems, ...frameItems];
  }, [seedKey, fieldGlyphs, frames, haunted]);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const camera = q("[data-camera]")[0];
      const items = q("[data-item]");
      const beatEls = q("[data-beat]");

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 1.1 },
      });

      tl.fromTo(camera, { z: 0, rotateZ: 0 }, { z: DEPTH, rotateZ: spooky ? -22 : 14, duration: 1 }, 0);

      items.forEach((el) => {
        const pass = Number(el.dataset.z) / DEPTH;
        tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12 }, Math.max(0, pass - 0.42));
        tl.to(el, { autoAlpha: 0, duration: 0.05 }, Math.max(0, pass - 0.05));
      });

      const span = 0.86 / beatEls.length;
      beatEls.forEach((el, i) => {
        const words = el.querySelectorAll("[data-beat-word]");
        const rest = el.querySelectorAll("[data-beat-rest]");
        const at = i * span;
        if (i > 0) {
          tl.fromTo(el, { autoAlpha: 0, scale: 0.7, filter: "blur(12px)" }, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: span * 0.35 }, at);
          tl.from(words, { yPercent: 120, rotate: 6, stagger: 0.012, duration: span * 0.3 }, at);
          tl.from(rest, { y: 30, autoAlpha: 0, duration: span * 0.25 }, at + span * 0.12);
        }
        if (i < beatEls.length - 1) {
          tl.to(el, { autoAlpha: 0, scale: 1.5, filter: "blur(14px)", duration: span * 0.3 }, at + span * 0.7);
        }
      });

      tl.fromTo(q("[data-portal]"), { scale: 0.05, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.22 }, 0.72)
        .to(q("[data-portal]"), { scale: 9, autoAlpha: 0, duration: 0.14 }, 0.9)
        .fromTo(q("[data-flood]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.9)
        .to(q("[data-flood]"), { autoAlpha: 0, duration: 0.06 }, 0.97)
        .fromTo(q("[data-meter]"), { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0)
        .to(q("[data-hint]"), { autoAlpha: 0, duration: 0.05 }, 0.04);

      let lightning = null;
      if (spooky) {
        // Fog banks roll toward the camera at different speeds, and the
        // vignette closes in the deeper you go.
        q("[data-fog]").forEach((fog, i) => {
          tl.fromTo(fog, { scale: 0.8 + i * 0.15, xPercent: i % 2 ? 12 : -12 }, { scale: 2.6 + i * 0.4, xPercent: i % 2 ? -18 : 18, duration: 1 }, 0);
        });
        tl.fromTo(q("[data-vignette]"), { "--wi-hole": "70%" }, { "--wi-hole": "26%", duration: 0.7 }, 0.05)
          .to(q("[data-vignette]"), { "--wi-hole": "70%", duration: 0.2 }, 0.8);

        // Glyphs that refuse to stay lit.
        q("[data-flicker]").forEach((g) => {
          gsap.to(g, {
            opacity: () => gsap.utils.random(0.15, 1),
            duration: () => gsap.utils.random(0.05, 0.18),
            repeat: -1, repeatRefresh: true, repeatDelay: gsap.utils.random(0.3, 2.6), ease: "steps(1)",
          });
        });

        // Lightning far away in the accent colour, at uneven intervals.
        const flash = q("[data-lightning]")[0];
        const strike = () => {
          gsap.timeline({ onComplete: () => { lightning = gsap.delayedCall(gsap.utils.random(3, 8), strike); } })
            .to(flash, { autoAlpha: 0.9, duration: 0.05 })
            .to(flash, { autoAlpha: 0.15, duration: 0.08 })
            .to(flash, { autoAlpha: 0.7, duration: 0.04 })
            .to(flash, { autoAlpha: 0, duration: 0.9, ease: "power2.out" });
        };
        lightning = gsap.delayedCall(2.2, strike);
      }

      gsap.from(q("[data-beat]:first-child [data-beat-word]"), { yPercent: 120, rotate: 6, duration: 1.3, stagger: 0.07, ease: "expo.out", delay: 0.5 });
      gsap.from(q("[data-beat]:first-child [data-beat-rest]"), { y: 24, autoAlpha: 0, duration: 1, stagger: 0.1, ease: "expo.out", delay: 0.9 });
      gsap.from(q("[data-hint], [data-skip]"), { autoAlpha: 0, y: 20, duration: 1, delay: 1.4, ease: "expo.out" });

      const lean = q("[data-lean]")[0];
      const rx = gsap.quickTo(lean, "rotateX", { duration: 1.4, ease: "power3.out" });
      const ry = gsap.quickTo(lean, "rotateY", { duration: 1.4, ease: "power3.out" });
      const onMove = (e) => {
        ry((e.clientX / window.innerWidth - 0.5) * 10);
        rx((0.5 - e.clientY / window.innerHeight) * 8);
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      // Created mid page-transition (the page may still be scaled), so
      // measure again once it has settled.
      const refresh = gsap.delayedCall(1.1, () => tl.scrollTrigger?.refresh());

      return () => {
        window.removeEventListener("pointermove", onMove);
        refresh.kill();
        lightning?.kill();
      };
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [seedKey, spooky] });

  const skip = () => {
    const el = root.current;
    if (!el) return;
    const end = el.getBoundingClientRect().bottom + window.scrollY - 40;
    window.scrollTo({ top: end, behavior: "smooth" });
  };

  const toneStyle = {
    a: { color: mix("--wi-accent", 85), textShadow: `0 0 30px ${mix("--wi-accent", 55)}` },
    b: { color: mix("--wi-accent-2", 80), textShadow: `0 0 30px ${mix("--wi-accent-2", 50)}` },
    ink: { color: mix("--wi-ink", 45) },
  };

  return (
    <section
      ref={root}
      data-haunted={haunted ? "" : undefined}
      aria-label={beats[0]?.title?.replace(/\*/g, "")}
      className={cn(
        "relative !flex-none mb-16 ml-[calc(50%-50vw)] w-screen motion-reduce:!h-auto",
        inset === "shell" && "-mt-6 sm:-mt-8 lg:-mt-10 lg:ml-[calc(50%-50vw+128px)] lg:w-[calc(100vw-256px)]",
        className,
      )}
      style={{ ...VARS, ...(spooky ? SPOOKY_VARS : null), height: `calc(${length} * 100svh)` }}
    >
      <div
        className="sticky overflow-hidden motion-reduce:relative motion-reduce:h-auto motion-reduce:min-h-[70svh]"
        // Inside the member shell the stage sits below the 4rem sticky top bar.
        style={{
          top: inset === "shell" ? "4rem" : 0,
          height: inset === "shell" ? "calc(100svh - 4rem)" : "100svh",
          background: spooky ? "var(--wi-fog)" : undefined,
        }}
      >
        {/* the field */}
        <div className="absolute inset-0 [perspective:900px] motion-reduce:hidden" aria-hidden="true">
          <div data-lean className="absolute inset-0 [transform-style:preserve-3d]">
            <div data-camera className="absolute left-1/2 top-1/2 [transform-style:preserve-3d] will-change-transform">
              {field.map((it, i) => (
                <div
                  key={i}
                  data-item
                  data-z={it.z}
                  className="absolute left-0 top-0"
                  style={{ transform: `translate3d(${it.x}px, ${it.y}px, ${-it.z}px) rotate(${it.kind === "glyph" ? it.spin : 0}deg)` }}
                >
                  {it.kind === "glyph" ? (
                    <span
                      data-flicker={spooky && it.flicker ? "" : undefined}
                      className="block -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-['Outfit',system-ui,sans-serif] font-medium leading-none"
                      style={{ fontSize: it.size, ...toneStyle[it.tone] }}
                    >
                      {it.text}
                    </span>
                  ) : (
                    <figure
                      className="overflow-hidden rounded-xl"
                      style={{
                        width: 300, height: 210,
                        transform: `translate(-50%,-50%) rotateY(${it.tilt}deg)`,
                        border: `1px solid ${mix("--wi-accent", 40)}`,
                        background: "var(--wi-paper)",
                        boxShadow: `0 0 60px -10px ${mix("--wi-accent", 45)}`,
                      }}
                    >
                      {it.src ? (
                        <img src={it.src} alt="" loading="lazy" className="h-full w-full object-cover" style={spooky ? { filter: "grayscale(0.55) contrast(1.1) brightness(0.85)" } : undefined} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-6 text-center text-2xl" style={{ color: "var(--wi-ink)" }}>
                          {it.label}
                        </div>
                      )}
                    </figure>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {spooky ? (
          <>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                data-fog
                aria-hidden="true"
                className="pointer-events-none absolute inset-[-20%] motion-reduce:hidden"
                style={{
                  background: `radial-gradient(ellipse 45% 30% at ${30 + i * 20}% ${40 + (i % 2) * 25}%, ${mix("--wi-ink", 9 - i * 2)}, transparent 70%)`,

                }}
              />
            ))}
            <div data-lightning aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 motion-reduce:hidden"
              style={{ background: `radial-gradient(ellipse at 70% 10%, ${mix("--wi-accent", 45)}, transparent 55%)`, mixBlendMode: "screen" }}
            />
          </>
        ) : null}

        {/* the portal at the end of the corridor */}
        <div data-portal aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[46vmin] w-[46vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 motion-reduce:hidden"
          style={{
            background: `radial-gradient(circle, ${mix("--wi-accent", 55)} 0%, ${mix("--wi-accent", 15)} 45%, transparent 70%)`,
            boxShadow: `0 0 0 2px ${mix("--wi-accent", 70)}, 0 0 120px 30px ${mix("--wi-accent", 35)}, inset 0 0 80px ${mix("--wi-accent-2", 60)}`,
          }}
        />
        <div data-flood aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 motion-reduce:hidden"
          style={{ background: `radial-gradient(circle at 50% 50%, ${mix("--wi-accent", 50)}, var(--wi-paper) 75%)` }}
        />

        {/* vignette keeps type legible over the field; in spooky mood it closes in */}
        <div
          data-vignette
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            "--wi-hole": spooky ? "70%" : "20%",
            background: `radial-gradient(ellipse at center, transparent var(--wi-hole), color-mix(in srgb, var(--wi-paper) ${spooky ? 96 : 85}%, transparent) calc(var(--wi-hole) + 45%))`,
          }}
        />

        {/* the story */}
        <div className="absolute inset-0 grid place-items-center px-6 motion-reduce:relative motion-reduce:min-h-[70svh] motion-reduce:py-24">
          {beats.map((b, i) => (
            <div
              key={b.title}
              data-beat
              className={cn("col-start-1 row-start-1 mx-auto max-w-4xl text-center", i > 0 && "invisible opacity-0 motion-reduce:hidden")}
            >
              {b.kicker ? <p data-beat-rest className="mb-4 text-sm font-medium sm:text-base" style={{ color: "var(--wi-accent)" }}>{b.kicker}</p> : null}
              <h2
                data-world-title
                className={cn(
                  "font-['Outfit',system-ui,sans-serif] font-medium",
                  i === 0 ? "text-[2.75rem] leading-[0.98] sm:text-7xl lg:text-[6.5rem]" : "text-4xl leading-[1.02] sm:text-6xl lg:text-7xl",
                )}
                style={{ textWrap: "balance", color: "var(--wi-ink)", letterSpacing: "-0.04em" }}
              >
                <Words text={b.title} />
              </h2>
              {b.body ? (
                <p data-beat-rest className="mx-auto mt-6 max-w-[52ch] text-base leading-7 sm:text-lg" style={{ color: "var(--wi-muted)" }}>{b.body}</p>
              ) : null}
              {i === beats.length - 1 && cta ? <div data-beat-rest className="mt-8 flex justify-center gap-3">{cta}</div> : null}
            </div>
          ))}
        </div>

        {/* scroll hint, progress and the way out */}
        <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-3 motion-reduce:hidden" style={{ bottom: "calc(var(--dock-offset, 0px) + 1.5rem)" }}>
          <p data-hint className="text-sm" style={{ color: "var(--wi-muted)" }}>Scroll to enter</p>
          <div className="h-px w-40 overflow-hidden rounded-full" style={{ background: "var(--wi-line)" }}>
            <div data-meter className="h-full origin-left" style={{ background: "var(--wi-accent)", boxShadow: "0 0 10px var(--wi-accent)" }} />
          </div>
        </div>
        <button
          type="button"
          data-skip
          onClick={skip}
          className="absolute right-4 top-4 rounded-full border px-3.5 py-1.5 text-[13px] backdrop-blur transition motion-reduce:hidden sm:right-6 sm:top-6"
          style={{ borderColor: "var(--wi-line)", color: "var(--wi-muted)", background: mix("--wi-paper", 60) }}
        >
          {skipLabel}
        </button>
      </div>
    </section>
  );
}
