/**
 * LampBackdrop — the one living background behind every Lamplight page.
 *
 * Layers, back to front:
 *   1. graph paper, faded out toward the edges
 *   2. the lamp: a warm glow that drifts and leans toward the pointer
 *   3. a violet ink pool in the far corner
 *   4. a large hyperbola and its dashed asymptotes, drawn once on
 *      mount and parallaxed against scroll
 *
 * Fixed and pointer-events:none, so it never interferes with a page.
 */
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";

export default function LampBackdrop() {
  const root = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const lamp = q("[data-lamp]")[0];
      const ink = q("[data-ink]")[0];
      const curves = q("[data-curve]");

      curves.forEach((path, i) => {
        const len = path.getTotalLength();
        gsap.fromTo(path,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, duration: 3.2, delay: 0.3 + i * 0.25, ease: "power2.inOut" });
      });

      gsap.to(lamp, { xPercent: -8, yPercent: 10, scale: 1.08, duration: 9, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(ink, { xPercent: 10, yPercent: -6, duration: 12, ease: "sine.inOut", yoyo: true, repeat: -1 });

      const lx = gsap.quickTo(q("[data-lean]")[0], "x", { duration: 1.6, ease: "power3.out" });
      const ly = gsap.quickTo(q("[data-lean]")[0], "y", { duration: 1.6, ease: "power3.out" });
      const onMove = (e) => {
        lx((e.clientX / window.innerWidth - 0.5) * 60);
        ly((e.clientY / window.innerHeight - 0.5) * 40);
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      gsap.to(q("[data-plot]")[0], {
        yPercent: -18, rotate: -4, ease: "none",
        scrollTrigger: { trigger: document.documentElement, start: 0, end: "max", scrub: 1.2 },
      });

      return () => window.removeEventListener("pointermove", onMove);
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        data-grid
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--rule) / 0.55) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--rule) / 0.55) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 70% at 60% 20%, black 10%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 60% 20%, black 10%, transparent 75%)",
        }}
      />
      <div data-lean className="absolute inset-0">
        <div
          data-lamp
          className="absolute -right-[18vw] -top-[30vh] h-[80vh] w-[70vw] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgb(var(--lamp)/0.20), rgb(var(--lamp)/0.06) 55%, transparent)" }}
        />
      </div>
      <div
        data-ink
        className="absolute -bottom-[35vh] -left-[20vw] h-[80vh] w-[60vw] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(var(--violet)/0.16), transparent)" }}
      />
      <svg
        data-plot
        className="absolute -right-[6vw] top-[6vh] h-[90vh] w-[70vw] opacity-60"
        viewBox="0 0 700 600"
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        <path data-curve d="M120 0 V600" stroke="rgb(var(--rule))" strokeWidth="1.2" strokeDasharray="6 8" />
        <path data-curve d="M0 520 H700" stroke="rgb(var(--rule))" strokeWidth="1.2" strokeDasharray="6 8" />
        <path data-curve d="M134 0 C 150 300, 220 470, 700 506" stroke="rgb(var(--lamp)/0.55)" strokeWidth="1.6" strokeLinecap="round" />
        <path data-curve d="M146 0 C 190 260, 300 440, 700 488" stroke="rgb(var(--violet)/0.35)" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 120%, rgb(var(--color-obsidian)) 10%, transparent 60%)" }}
      />
    </div>
  );
}
