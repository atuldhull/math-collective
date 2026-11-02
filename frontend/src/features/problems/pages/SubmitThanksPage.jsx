/**
 * SubmitThanksPage — confirmation after a problem submission.
 *
 * Intentionally minimal — just the "you've contributed" beat and a
 * pair of next-step links. The list of the user's own submissions
 * (and their statuses) lives on /profile via the existing list
 * endpoint; we link there from here so they can track approval
 * without having to know the URL.
 *
 * The beat itself: a lamp-lit seal draws its ring and tick, then a
 * spray of maths glyphs bursts out of it and drifts down like
 * confetti while the words rise into place.
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, Plus } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { AsymptoteCurve } from "@/components/lamp";

const GLYPHS = ["∑", "π", "∞", "√", "∫", "Δ", "λ", "φ", "θ", "ε", "∂", "≈", "∀", "∃", "e", "i", "+", "×"];

export default function SubmitThanksPage() {
  const root = useRef(null);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const q = gsap.utils.selector(root);
    const ring = q("[data-ring]")[0];
    const tick = q("[data-tick]")[0];
    const ringLen = ring.getTotalLength();
    const tickLen = tick.getTotalLength();

    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.fromTo(q("[data-seal]"), { scale: 0.4, autoAlpha: 0, rotate: -40 }, { scale: 1, autoAlpha: 1, rotate: 0, duration: 1, ease: "back.out(1.8)" })
      .fromTo(ring, { strokeDasharray: ringLen, strokeDashoffset: ringLen }, { strokeDashoffset: 0, duration: 1.1 }, 0.1)
      .fromTo(tick, { strokeDasharray: tickLen, strokeDashoffset: tickLen }, { strokeDashoffset: 0, duration: 0.6, ease: "power3.out" }, 0.6)
      .fromTo(q("[data-halo]"), { scale: 0.6, autoAlpha: 0.9 }, { scale: 2.6, autoAlpha: 0, duration: 1.4, ease: "power2.out" }, 0.75)
      .from(q("[data-rise]"), { y: 28, autoAlpha: 0, duration: 1, stagger: 0.09 }, 0.7);

    // Glyph burst: each glyph flies out on its own angle, then falls
    // with a little spin, like confetti that knows some maths.
    // Keep the spray inside the viewport so phones never scroll sideways.
    const maxX = Math.max(80, window.innerWidth / 2 - 28);
    q("[data-glyph]").forEach((el) => {
      const angle = gsap.utils.random(-Math.PI, 0);
      const dist = gsap.utils.random(120, 340);
      const x = gsap.utils.clamp(-maxX, maxX, Math.cos(angle) * dist);
      const y = Math.sin(angle) * dist;
      gsap.timeline({ delay: 0.75 + gsap.utils.random(0, 0.15) })
        .fromTo(el, { x: 0, y: 0, scale: 0.2, autoAlpha: 0, rotate: 0 }, {
          x, y, scale: gsap.utils.random(0.8, 1.5), autoAlpha: 1, rotate: gsap.utils.random(-90, 90),
          duration: 0.9, ease: "expo.out",
        })
        .to(el, {
          y: y + gsap.utils.random(220, 420), x: gsap.utils.clamp(-maxX, maxX, x + gsap.utils.random(-40, 40)),
          rotate: `+=${gsap.utils.random(-180, 180)}`, autoAlpha: 0,
          duration: gsap.utils.random(1.8, 2.8), ease: "power1.in",
        })
        .set(el, { clearProps: "all" });
    });

    // The seal keeps breathing gently once the burst has settled.
    gsap.to(q("[data-seal]"), { y: -6, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.6 });
  }, { scope: root });

  return (
    <div ref={root} className="relative mx-auto flex w-full max-w-2xl flex-col items-center py-14 text-center sm:py-20">
      {/* Seal + glyph burst origin */}
      <div className="relative mb-10 grid h-32 w-32 place-items-center">
        <span data-halo aria-hidden="true" className="absolute inset-0 rounded-full border border-primary/60 opacity-0" />
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
          {GLYPHS.map((g, i) => (
            <span
              key={i}
              data-glyph
              className="lamp-display absolute -translate-x-1/2 -translate-y-1/2 text-xl opacity-0"
              style={{ color: i % 3 === 0 ? "rgb(var(--violet))" : "rgb(var(--lamp))" }}
            >
              {g}
            </span>
          ))}
        </div>
        <svg data-seal viewBox="0 0 120 120" className="relative h-32 w-32 drop-shadow-[0_0_30px_rgb(var(--lamp)/0.45)]" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="rgb(var(--lamp)/0.08)" />
          <circle data-ring cx="60" cy="60" r="52" fill="none" stroke="rgb(var(--lamp))" strokeWidth="3" strokeLinecap="round" transform="rotate(-90 60 60)" />
          <path data-tick d="M38 62 L54 77 L84 44" fill="none" stroke="rgb(var(--lamp))" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <p data-rise className="text-sm font-medium text-success">Submitted</p>
      <h1
        data-rise
        className="lamp-display mt-3 text-[2.1rem] leading-[1.05] text-text-primary sm:text-5xl"
        style={{ textWrap: "balance" }}
      >
        Thanks — it's in the review queue.
      </h1>
      <p data-rise className="mt-4 max-w-[54ch] text-base leading-7 text-text-muted">
        An admin will check it over (usually within a day or two). If approved, it lands in the catalogue with you credited as the contributor.
        You'll see it under "Your submissions" on your profile until then.
      </p>

      <div data-rise className="mt-8 w-56">
        <AsymptoteCurve className="h-14 w-full" delay={1} />
      </div>

      <div data-rise className="mt-8 flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
        <Link
          to="/problems/submit"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-[rgb(var(--color-obsidian))] shadow-[0_10px_30px_-12px_rgb(var(--lamp)/0.8)] transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Submit another
        </Link>
        <Link
          to="/problems"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-5 text-sm font-medium text-text-primary transition hover:border-primary/40"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Back to catalogue
        </Link>
      </div>
    </div>
  );
}
