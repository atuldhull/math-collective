/**
 * LiveStage — the shared floor every live-quiz screen stands on.
 *
 * No backdrop of its own (the shell paints that); just one local lamp
 * pooled behind the content, tinted by the moment: the accent while you
 * play, green on a correct answer, red on a miss, violet in the lobby.
 * The pool breathes slowly so the room feels live while you wait.
 */
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";

const TONES = {
  lamp: "rgb(var(--lamp)/0.22)",
  violet: "rgb(var(--violet)/0.22)",
  good: "rgb(var(--color-success)/0.2)",
  bad: "rgb(var(--color-danger)/0.2)",
  warn: "rgb(var(--color-warning)/0.18)",
};

export default function LiveStage({ tone = "lamp", center = false, className, children }) {
  const glow = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(glow.current, { scaleY: 0.9, autoAlpha: 0.65 }, {
        scaleY: 1.08, autoAlpha: 1, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1,
      });
    });
    return () => mm.revert();
  }, { scope: glow });

  return (
    <div className={cn("relative isolate pb-16", center && "flex min-h-[70vh] items-center justify-center", className)}>
      <div
        ref={glow}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-6%] -z-10 h-[620px] transition-[background] duration-700"
        style={{ background: `radial-gradient(ellipse 50% 50% at 50% 45%, ${TONES[tone] || TONES.lamp}, transparent 100%)` }}
      />
      {children}
    </div>
  );
}
