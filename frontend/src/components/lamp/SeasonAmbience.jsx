/**
 * SeasonAmbience — the living set dressing for a season pack.
 *
 * Haunted: a pumpkin-tinted moon behind the page, cobwebs in the
 * corners, ground fog rolling along the bottom, and every so often a bat
 * crossing the screen, a spider dropping on its thread, or the lights
 * flickering. Everything is pointer-events:none, so it never gets in the
 * way; reduced-motion users get the still scene (moon, webs, fog).
 */
import { useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import useHaunted from "./useHaunted";

const EMOJI = "font-['Segoe_UI_Emoji','Apple_Color_Emoji','Noto_Color_Emoji',sans-serif]";

/** A corner cobweb as one SVG path: spokes plus sagging rings. */
function webPath(size = 220, spokes = 7, rings = 7) {
  const parts = [];
  const angle = (i) => (i / (spokes - 1)) * (Math.PI / 2);
  for (let i = 0; i < spokes; i++) {
    parts.push(`M0 0 L${Math.cos(angle(i)) * size} ${Math.sin(angle(i)) * size}`);
  }
  for (let r = 1; r <= rings; r++) {
    const rr = (r / rings) * size;
    let d = "";
    for (let i = 0; i < spokes; i++) {
      const x = Math.cos(angle(i)) * rr, y = Math.sin(angle(i)) * rr;
      if (i === 0) d += `M${x} ${y}`;
      else {
        const mid = (angle(i) + angle(i - 1)) / 2;
        const sag = rr * 0.86;
        d += ` Q${Math.cos(mid) * sag} ${Math.sin(mid) * sag} ${x} ${y}`;
      }
    }
    parts.push(d);
  }
  return parts.join(" ");
}

function Cobweb({ className, flip }) {
  const d = useMemo(() => webPath(), []);
  return (
    <svg aria-hidden="true" viewBox="0 0 230 230" className={className} style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d={d} fill="none" stroke="rgb(var(--color-text-primary)/0.22)" strokeWidth="1" />
    </svg>
  );
}

function Haunted({ front }) {
  const root = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const calls = [];
      const later = (min, max, fn) => {
        const c = gsap.delayedCall(gsap.utils.random(min, max), () => { fn(); later(min, max, fn); });
        calls.push(c);
      };

      gsap.to(q("[data-moon]"), { y: -14, x: 8, duration: 9, ease: "sine.inOut", yoyo: true, repeat: -1 });
      q("[data-fog]").forEach((f, i) => gsap.to(f, { xPercent: i % 2 ? -18 : 18, duration: 14 + i * 4, ease: "sine.inOut", yoyo: true, repeat: -1 }));
      q("[data-web]").forEach((wb) => gsap.to(wb, { rotate: 2, transformOrigin: "0 0", duration: 4, ease: "sine.inOut", yoyo: true, repeat: -1 }));

      // A bat crosses the screen on a wavy path.
      const bat = q("[data-bat]")[0];
      later(5, 12, () => {
        const ltr = Math.random() < 0.5;
        const y0 = gsap.utils.random(8, 45);
        gsap.timeline()
          .set(bat, { autoAlpha: 1, left: ltr ? "-8%" : "108%", top: `${y0}%`, scaleX: ltr ? 1 : -1 })
          .to(bat, { left: ltr ? "108%" : "-8%", duration: gsap.utils.random(3.2, 5), ease: "none" }, 0)
          .to(bat, { top: `${y0 + gsap.utils.random(-12, 12)}%`, duration: 0.8, ease: "sine.inOut", yoyo: true, repeat: 5 }, 0)
          .to(bat, { scaleY: 0.45, duration: 0.09, yoyo: true, repeat: 40, ease: "none" }, 0)
          .set(bat, { autoAlpha: 0 });
      });

      // A spider drops on its thread, sways, and climbs back up.
      const spider = q("[data-spider]")[0];
      const thread = q("[data-thread]")[0];
      later(10, 20, () => {
        const x = `${gsap.utils.random(30, 92)}%`;
        const depth = gsap.utils.random(120, 300);
        gsap.timeline()
          .set([spider, thread], { autoAlpha: 1, left: x })
          .fromTo(thread, { height: 0 }, { height: depth, duration: 1.4, ease: "bounce.out" }, 0)
          .fromTo(spider, { y: -40 }, { y: depth, duration: 1.4, ease: "bounce.out" }, 0)
          .to(spider, { rotate: 14, duration: 0.5, yoyo: true, repeat: 5, ease: "sine.inOut" }, 1.4)
          .to(thread, { height: 0, duration: 1.1, ease: "power2.in" }, 4.4)
          .to(spider, { y: -40, duration: 1.1, ease: "power2.in" }, 4.4)
          .set([spider, thread], { autoAlpha: 0 });
      });

      // The lights flicker like a failing bulb.
      const dim = q("[data-flicker]")[0];
      later(9, 22, () => {
        gsap.timeline()
          .to(dim, { opacity: 0.55, duration: 0.05 })
          .to(dim, { opacity: 0.1, duration: 0.06 })
          .to(dim, { opacity: 0.7, duration: 0.04 })
          .to(dim, { opacity: 0.25, duration: 0.12 })
          .to(dim, { opacity: 0, duration: 0.3 });
      });

      return () => calls.forEach((c) => c.kill());
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} aria-hidden="true">
      {/* behind the page (the member shell only: public pages paint an
          opaque background, so there it would sit on top of the text) */}
      <div className={front ? "hidden" : "pointer-events-none fixed inset-0 z-0 overflow-hidden"}>
        <div
          data-moon
          className="absolute right-[8vw] top-[9vh] h-[26vmin] w-[26vmin] rounded-full"
          style={{
            background: "radial-gradient(circle at 38% 35%, rgb(255 236 200), rgb(255 190 120) 55%, rgb(var(--lamp)) 100%)",
            boxShadow: "0 0 80px 20px rgb(var(--lamp)/0.35), 0 0 220px 80px rgb(var(--lamp)/0.15)",
            opacity: 0.85,
          }}
        />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            data-fog
            className="absolute inset-x-[-25%] bottom-[-8vh] h-[34vh] rounded-[50%]"
            style={{
              background: `radial-gradient(ellipse at ${30 + i * 20}% 60%, rgb(var(--color-text-primary)/${0.1 - i * 0.025}), transparent 65%)`,

            }}
          />
        ))}
      </div>

      {/* in front of the page, never interactive */}
      <div className="pointer-events-none fixed inset-0 z-[35] overflow-hidden">
        <Cobweb className="absolute left-[var(--rail-w,0px)] top-16 h-40 w-40 opacity-80 max-lg:left-0" />
        <div data-web className="absolute right-0 top-16 h-40 w-40">
          <Cobweb className="h-full w-full opacity-80" flip />
        </div>
        <span data-bat className={`absolute text-4xl opacity-0 ${EMOJI}`}>🦇</span>
        <span data-thread className="absolute top-0 w-px bg-[rgb(var(--color-text-primary)/0.5)] opacity-0" />
        <span data-spider className={`absolute top-0 -ml-4 text-3xl opacity-0 ${EMOJI}`}>🕷️</span>
        <div data-flicker className="absolute inset-0 bg-black opacity-0" />
      </div>
    </div>
  );
}

/**
 * Extra set dressing for the public home page, only when the visitor
 * picked the Haunted theme. It sits over the existing hero without
 * touching it: ghosts drift around the Möbius strip, a bat swarm bursts
 * out of it now and then, candles float top right, jack-o'-lanterns glow
 * under it, eyes blink in the corners, fog rolls along the bottom and
 * lightning flickers far off. Pointer-events none throughout.
 */
const HOME_GHOSTS = [
  { left: "62%", top: "38%", size: 54, path: [[0, 0], [60, -40], [120, 10], [40, 50]] },
  { left: "84%", top: "62%", size: 42, path: [[0, 0], [-70, -30], [-20, -90], [30, -40]] },
];
// A mirrored pair on each edge of the page, clear of the headline, the
// sculpture and the header controls.
const HOME_CANDLES = [
  { side: "left", top: "30%", h: 46, inset: "1.6%" },
  { side: "left", top: "39%", h: 32, inset: "0.5%" },
  { side: "right", top: "30%", h: 46, inset: "1.6%" },
  { side: "right", top: "39%", h: 32, inset: "0.5%" },
];

function HomeHaunt() {
  const root = useRef(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const calls = [];
      const later = (min, max, fn) => {
        const c = gsap.delayedCall(gsap.utils.random(min, max), () => { fn(); later(min, max, fn); });
        calls.push(c);
      };

      q("[data-home-ghost]").forEach((g, i) => {
        const pts = HOME_GHOSTS[i].path;
        const tl = gsap.timeline({ repeat: -1, delay: i * 2.5 });
        tl.fromTo(g, { autoAlpha: 0, x: pts[0][0], y: pts[0][1] }, { autoAlpha: 0.55, duration: 1.5 });
        pts.slice(1).forEach(([x, y]) => tl.to(g, { x, y, duration: 2.6, ease: "sine.inOut" }));
        tl.to(g, { autoAlpha: 0, duration: 1.5 }, "-=1.2").to(g, { duration: gsap.utils.random(2, 5) });
        gsap.to(g, { rotate: 8, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });

      gsap.to(q("[data-home-candle]"), { y: -10, duration: (i) => 2.4 + i * 0.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(q("[data-home-flame]"), {
        scaleY: () => gsap.utils.random(0.8, 1.2), opacity: () => gsap.utils.random(0.7, 1),
        duration: 0.12, repeat: -1, repeatRefresh: true, ease: "none",
      });
      gsap.to(q("[data-home-pumpkin-glow]"), {
        opacity: () => gsap.utils.random(0.4, 1), scale: () => gsap.utils.random(0.9, 1.12),
        duration: 0.16, repeat: -1, repeatRefresh: true, ease: "none",
      });
      q("[data-home-eyes]").forEach((e) => gsap.to(e, { scaleY: 0.08, duration: 0.08, yoyo: true, repeat: -1, repeatDelay: gsap.utils.random(2, 5), ease: "none" }));
      gsap.to(q("[data-home-fog]"), { xPercent: (i) => (i % 2 ? -12 : 12), duration: (i) => 10 + i * 4, ease: "sine.inOut", yoyo: true, repeat: -1 });

      // A swarm bursts out of the sculpture and scatters.
      const bats = q("[data-home-bat]");
      later(6, 14, () => {
        gsap.timeline()
          .set(bats, { autoAlpha: 1, x: 0, y: 0, scale: 0.3 })
          .to(bats, {
            x: () => gsap.utils.random(-700, 500), y: () => gsap.utils.random(-500, 200),
            scale: () => gsap.utils.random(0.8, 1.5), rotate: () => gsap.utils.random(-30, 30),
            duration: () => gsap.utils.random(1.8, 3), ease: "power2.out", stagger: 0.05,
          })
          .to(bats, { scaleY: 0.4, duration: 0.1, yoyo: true, repeat: 20, ease: "none" }, 0)
          .to(bats, { autoAlpha: 0, duration: 0.6, stagger: 0.04 }, "-=0.8");
      });

      // Lightning far away.
      const flash = q("[data-home-flash]")[0];
      later(10, 24, () => {
        gsap.timeline()
          .to(flash, { opacity: 0.5, duration: 0.05 }).to(flash, { opacity: 0.08, duration: 0.07 })
          .to(flash, { opacity: 0.35, duration: 0.04 }).to(flash, { opacity: 0, duration: 0.8, ease: "power2.out" });
      });

      return () => calls.forEach((c) => c.kill());
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[34] overflow-hidden">
      <div data-home-flash className="absolute inset-0 opacity-0" style={{ background: "radial-gradient(ellipse at 80% 0%, rgb(255 220 180 / 0.55), transparent 60%)", mixBlendMode: "screen" }} />
      {HOME_GHOSTS.map((g, i) => (
        <span key={i} data-home-ghost className={`absolute opacity-0 ${EMOJI}`} style={{ left: g.left, top: g.top, fontSize: g.size, filter: "drop-shadow(0 0 16px rgb(220 230 255 / 0.55))" }}>👻</span>
      ))}
      {HOME_CANDLES.map((c, i) => (
        <span key={i} data-home-candle className="absolute" style={{ [c.side]: c.inset || "1.4%", top: c.top }}>
          <span data-home-flame className="absolute left-1/2 -top-4 -ml-[5px] block h-4 w-[10px] origin-bottom rounded-[50%_50%_50%_50%/60%_60%_40%_40%]" style={{ background: "radial-gradient(circle at 50% 70%, #fff7da, rgb(var(--lamp)) 60%, transparent 72%)", filter: "drop-shadow(0 0 10px rgb(var(--lamp)))" }} />
          <span className="block w-3 rounded-t-sm" style={{ height: c.h, background: "linear-gradient(180deg,#f2e6cc,#bfae8c)", opacity: 0.85 }} />
        </span>
      ))}
      <div className="absolute" style={{ left: "74%", top: "56%" }}>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} data-home-bat className={`absolute text-2xl opacity-0 ${EMOJI}`} style={{ filter: "brightness(0.6)" }}>🦇</span>
        ))}
      </div>
      {[["60%", 34], ["68%", 46], ["76%", 30]].map(([left, size], i) => (
        <span key={i} className={`absolute bottom-[3%] ${EMOJI}`} style={{ left, fontSize: size, lineHeight: 1 }}>
          <span data-home-pumpkin-glow className="absolute -inset-6 -z-10 rounded-full" style={{ background: "radial-gradient(circle, rgb(var(--lamp)/0.55), transparent 65%)" }} />
          🎃
        </span>
      ))}
      <span data-home-eyes className="absolute left-[1%] top-[64%] h-2 w-7" style={{ background: "radial-gradient(ellipse 5px 4px at 6px 50%, rgb(var(--violet)) 90%, transparent), radial-gradient(ellipse 5px 4px at 21px 50%, rgb(var(--violet)) 90%, transparent)", filter: "drop-shadow(0 0 5px rgb(var(--violet)))" }} />
      <span data-home-eyes className="absolute right-[1%] top-[64%] h-2 w-7" style={{ background: "radial-gradient(ellipse 5px 4px at 6px 50%, rgb(var(--lamp)) 90%, transparent), radial-gradient(ellipse 5px 4px at 21px 50%, rgb(var(--lamp)) 90%, transparent)", filter: "drop-shadow(0 0 5px rgb(var(--lamp)))" }} />
      {[0, 1].map((i) => (
        <span key={i} data-home-fog className="absolute inset-x-[-20%] h-[22vh]" style={{ bottom: `${-6 + i * 4}vh`, background: `radial-gradient(ellipse 55% 60% at 50% 80%, rgb(var(--color-text-primary)/${0.12 - i * 0.04}), transparent 70%)` }} />
      ))}
    </div>
  );
}

export default function SeasonAmbience({ front = false }) {
  const haunted = useHaunted();
  const { pathname } = useLocation();
  if (!haunted) return null;
  return (
    <>
      <Haunted front={front} />
      {front && pathname === "/" ? <HomeHaunt /> : null}
    </>
  );
}
