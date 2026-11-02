/**
 * HauntedAuth — the sign in / join screen under the Halloween treatment.
 *
 * HauntedAuthScene replaces the threshold story on the left with a night
 * scene: moon and clouds, bats circling, a castle on the hill with its
 * windows flickering, a dead tree, a graveyard with a ghost rising from
 * it, a jack-o'-lantern, eyes in the dark, a spider on its thread and
 * ground fog. HauntedCard frames the form as a gravestone slab with
 * blood dripping from its top edge.
 *
 * Purely presentational: the forms inside are the normal LoginPage /
 * RegisterPage with every label, button and handler unchanged.
 */
import { useMemo, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import "./haunted-auth.css";

/** A gnarled tree as line segments, generated once. */
function treeSegments(x, y, len, angle, depth, out) {
  if (depth === 0) return out;
  const x2 = x + Math.cos(angle) * len;
  const y2 = y + Math.sin(angle) * len;
  out.push({ x1: x, y1: y, x2, y2, w: depth * 1.5 });
  treeSegments(x2, y2, len * 0.7, angle - 0.5 + Math.sin(depth * 3) * 0.15, depth - 1, out);
  treeSegments(x2, y2, len * 0.66, angle + 0.42 + Math.cos(depth * 2) * 0.15, depth - 1, out);
  if (depth > 4) treeSegments(x2, y2, len * 0.5, angle + 0.05, depth - 2, out);
  return out;
}

const STARS = Array.from({ length: 38 }, (_, i) => ({
  x: (i * 37) % 100,
  y: (i * 53) % 60,
  s: 1 + (i % 3),
  d: (i % 7) * 0.4,
}));

export function HauntedAuthScene() {
  const root = useRef(null);
  const tree = useMemo(() => treeSegments(70, 250, 62, -Math.PI / 2 - 0.08, 7, []), []);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-rise]"), { y: 40, autoAlpha: 0, duration: 1.1, stagger: 0.12, ease: "expo.out", delay: 0.2 });
      gsap.from(q("[data-drip-word]"), { yPercent: -120, scaleY: 1.8, transformOrigin: "50% 0%", autoAlpha: 0, duration: 1.2, ease: "elastic.out(1, 0.5)", stagger: 0.08, delay: 0.35 });
      gsap.to(q("[data-cloud]"), { xPercent: (i) => (i % 2 ? -60 : 60), duration: (i) => 18 + i * 6, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(q("[data-moon]"), { scale: 1.04, duration: 4, ease: "sine.inOut", yoyo: true, repeat: -1 });
      q("[data-orbit]").forEach((o, i) => gsap.to(o, { rotate: i % 2 ? -360 : 360, duration: 9 + i * 3, ease: "none", repeat: -1 }));
      gsap.to(q("[data-flap]"), { scaleY: 0.45, duration: 0.12, ease: "none", yoyo: true, repeat: -1, stagger: 0.05 });
      gsap.to(q("[data-window]"), {
        opacity: () => gsap.utils.random(0.25, 1),
        duration: () => gsap.utils.random(0.08, 0.4),
        repeat: -1, repeatRefresh: true, ease: "steps(1)",
      });
      gsap.timeline({ repeat: -1, repeatDelay: 1.6 })
        .fromTo(q("[data-ghost]"), { y: 40, scale: 0.6 }, { y: -170, scale: 1, duration: 4.2, ease: "sine.out" }, 0)
        .fromTo(q("[data-ghost]"), { autoAlpha: 0 }, { autoAlpha: 0.9, duration: 1 }, 0)
        .to(q("[data-ghost]"), { autoAlpha: 0, duration: 1 }, 3.2);
      gsap.to(q("[data-ghost]"), { x: 18, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(q("[data-pumpkin-glow]"), { opacity: () => gsap.utils.random(0.45, 1), scale: () => gsap.utils.random(0.9, 1.15), duration: 0.18, repeat: -1, repeatRefresh: true, ease: "none" });
      q("[data-eyes]").forEach((e) => gsap.to(e, { scaleY: 0.08, duration: 0.08, yoyo: true, repeat: -1, repeatDelay: gsap.utils.random(1.8, 4), ease: "none" }));
      gsap.to(q("[data-fog]"), { xPercent: (i) => (i % 2 ? -14 : 14), duration: (i) => 9 + i * 4, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.fromTo(q("[data-spider]"), { y: -20 }, { y: 120, duration: 2.4, ease: "bounce.out", repeat: -1, yoyo: true, repeatDelay: 2.2 });
      gsap.to(q("[data-star]"), { opacity: 0.2, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: { each: 0.15, from: "random" } });
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <aside ref={root} className="mc-haunt-scene">
      <div className="mc-haunt-copy">
        <p data-rise className="mc-haunt-kicker">The collective meets after midnight</p>
        <h2 className="mc-haunt-title">
          {["Enter", "if", "you", "dare."].map((w, i) => (
            <span key={w} className={i > 0 ? "mc-haunt-accent" : undefined}>
              <span data-drip-word>{w}</span>{" "}
            </span>
          ))}
        </h2>
        <p data-rise className="mc-haunt-sub">
          Sign in before the candles burn out. The problems are waiting in the dark, and so is everyone else.
        </p>
      </div>

      <div className="mc-haunt-sky" aria-hidden="true">
        {STARS.map((s, i) => (
          <span key={i} data-star className="mc-haunt-star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s }} />
        ))}
        <div className="mc-haunt-moon-wrap">
          <div data-moon className="mc-haunt-moon">
            <span className="mc-haunt-crater" style={{ left: "28%", top: "30%", width: "18%", height: "18%" }} />
            <span className="mc-haunt-crater" style={{ left: "58%", top: "52%", width: "12%", height: "12%" }} />
            <span className="mc-haunt-crater" style={{ left: "40%", top: "66%", width: "9%", height: "9%" }} />
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} data-orbit className="mc-haunt-orbit" style={{ "--r": `${110 + i * 26}px`, "--start": `${i * 72}deg` }}>
              <span className="mc-haunt-bat"><span data-flap>🦇</span></span>
            </div>
          ))}
        </div>
        <span data-cloud className="mc-haunt-cloud" style={{ top: "22%", left: "8%" }} />
        <span data-cloud className="mc-haunt-cloud" style={{ top: "38%", left: "46%", transform: "scale(1.4)" }} />

        <svg className="mc-haunt-land" viewBox="0 0 600 260" preserveAspectRatio="xMidYMax slice">
          <path className="mc-haunt-hill" d="M0 260 L0 205 Q120 160 250 182 Q360 200 450 168 Q530 142 600 160 L600 260 Z" />
          <g className="mc-haunt-castle">
            <path d="M372 172 V108 H382 V100 H390 V108 H400 V100 H408 V108 H418 V100 H426 V108 H432 V172 Z" />
            <path d="M342 174 V92 H368 V174 Z M338 92 L355 52 L372 92 Z" />
            <path d="M436 170 V80 H462 V170 Z M432 80 L449 34 L466 80 Z" />
            <path d="M392 108 L402 66 L412 108 Z" />
          </g>
          {[[351, 110], [351, 132], [446, 98], [446, 124], [384, 124], [412, 124], [398, 146]].map(([x, y], i) => (
            <rect key={i} data-window className="mc-haunt-window" x={x} y={y} width="7" height="10" rx="3" />
          ))}
          <g className="mc-haunt-tree">
            {tree.map((s, i) => (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth={s.w} strokeLinecap="round" />
            ))}
          </g>
          <g className="mc-haunt-graves">
            <path d="M150 260 V222 Q150 200 172 200 Q194 200 194 222 V260 Z" />
            <path d="M214 260 V232 Q214 216 230 216 Q246 216 246 232 V260 Z" />
            <path d="M520 260 V214 H528 V200 H540 V214 H548 V226 H540 V260 H528 V226 H520 Z" />
            <path d="M268 260 V236 Q268 222 282 222 Q296 222 296 236 V260 Z" />
          </g>
          <text x="172" y="240" className="mc-haunt-rip">RIP</text>
        </svg>

        <span data-ghost className="mc-haunt-ghost">👻</span>
        <span className="mc-haunt-pumpkin">
          <span data-pumpkin-glow className="mc-haunt-pumpkin-glow" />
          🎃
        </span>
        <span data-eyes className="mc-haunt-eyes" style={{ left: "68%", bottom: "16%" }} />
        <span data-eyes className="mc-haunt-eyes" style={{ left: "86%", bottom: "11%" }} />
        <span className="mc-haunt-thread" />
        <span data-spider className="mc-haunt-spider">🕷️</span>
        {[0, 1].map((i) => <span key={i} data-fog className="mc-haunt-fog" style={{ bottom: `${-6 + i * 5}%`, opacity: 0.8 - i * 0.25 }} />)}
      </div>
    </aside>
  );
}

const DRIPS = [6, 14, 21, 33, 47, 58, 66, 79, 88, 95];

export function HauntedCard({ children }) {
  const root = useRef(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.from(root.current, { y: 40, rotateX: -12, autoAlpha: 0, transformPerspective: 1000, duration: 1, ease: "expo.out" });
      gsap.fromTo(q("[data-drip]"), { scaleY: 0 }, { scaleY: 1, transformOrigin: "50% 0%", duration: () => gsap.utils.random(1.4, 2.6), ease: "power2.in", stagger: { each: 0.12, from: "random" }, delay: 0.4 });
      gsap.to(q("[data-drip]"), { scaleY: 1.25, duration: () => gsap.utils.random(2, 4), ease: "sine.inOut", yoyo: true, repeat: -1, delay: 3 });
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} className="mc-haunt-card">
      <svg className="mc-haunt-drips" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true">
        <rect x="0" y="0" width="100" height="3" />
        {DRIPS.map((x, i) => (
          <g key={x} data-drip>
            <rect x={x - 0.6} y="2" width="1.2" height={6 + (i % 4) * 3} rx="0.6" />
            <ellipse cx={x} cy={8 + (i % 4) * 3} rx="1.15" ry="1.4" />
          </g>
        ))}
      </svg>
      <svg className="mc-haunt-web" viewBox="0 0 120 120" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 5) * (Math.PI / 2);
          return <line key={i} x1="120" y1="0" x2={120 - Math.cos(a) * 120} y2={Math.sin(a) * 120} />;
        })}
        {[24, 48, 72, 96].map((r) => (
          <path key={r} d={`M${120 - r} 0 Q${120 - r * 0.72} ${r * 0.72} 120 ${r}`} fill="none" />
        ))}
      </svg>
      <span className="mc-haunt-candle mc-haunt-candle--l" aria-hidden="true"><span /></span>
      <span className="mc-haunt-candle mc-haunt-candle--r" aria-hidden="true"><span /></span>
      <div className="mc-haunt-card-body">{children}</div>
    </div>
  );
}
