/**
 * ReadingCurve — the asymptote as a reading-progress meter.
 *
 * The curve draws itself as the reader scrolls through `targetRef`
 * (scrubbed ScrollTrigger) and the lamp dot rides its tip toward the
 * dashed line it can approach but never meet. A ResizeObserver
 * refreshes the trigger when lazy panels (writeups, comments) grow the
 * article after mount.
 */
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/cn";

const CURVE = "M4 4 C 30 52, 90 70, 296 74";

export default function ReadingCurve({ targetRef, className }) {
  const root = useRef(null);
  const label = useRef(null);

  useGSAP(() => {
    const svg = root.current;
    const target = targetRef?.current;
    if (!svg || !target) return undefined;
    const path = svg.querySelector("[data-path]");
    const dot = svg.querySelector("[data-dot]");
    const len = path.getTotalLength();

    const place = (t) => {
      const pt = path.getPointAtLength(len * t);
      dot.setAttribute("cx", pt.x);
      dot.setAttribute("cy", pt.y);
      if (label.current) label.current.textContent = `${Math.round(t * 100)}%`;
    };

    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    place(0);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = { t: 0 };
    const st = ScrollTrigger.create({
      trigger: target,
      start: "top 30%",
      end: "bottom bottom",
      onUpdate: (self) => {
        if (reduced) {
          gsap.set(path, { strokeDashoffset: len * (1 - self.progress) });
          place(self.progress);
          return;
        }
        gsap.to(state, {
          t: self.progress,
          duration: 0.5,
          ease: "power3.out",
          overwrite: true,
          onUpdate: () => {
            gsap.set(path, { strokeDashoffset: len * (1 - state.t) });
            place(state.t);
          },
        });
      },
    });

    let timer = 0;
    const ro = typeof window.ResizeObserver !== "undefined"
      ? new window.ResizeObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => ScrollTrigger.refresh(), 150);
      })
      : null;
    ro?.observe(target);

    return () => {
      clearTimeout(timer);
      ro?.disconnect();
      st.kill();
    };
  }, { scope: root, dependencies: [targetRef] });

  return (
    <div className={cn("flex items-end gap-3", className)}>
      <svg ref={root} viewBox="0 0 300 80" fill="none" aria-hidden="true" className="h-12 min-w-0 flex-1 overflow-visible">
        <line x1="0" y1="78" x2="300" y2="78" stroke="rgb(var(--rule))" strokeWidth="1.2" strokeDasharray="4 6" />
        <path d={CURVE} stroke="rgb(var(--rule))" strokeWidth="2" strokeLinecap="round" />
        <path data-path d={CURVE} stroke="rgb(var(--lamp))" strokeWidth="2" strokeLinecap="round" />
        <circle data-dot r="4.5" cx="4" cy="4" fill="rgb(var(--lamp))" style={{ filter: "drop-shadow(0 0 6px rgb(var(--lamp)))" }} />
      </svg>
      <span ref={label} className="lamp-numerals w-10 shrink-0 text-right text-sm text-text-muted">0%</span>
    </div>
  );
}
