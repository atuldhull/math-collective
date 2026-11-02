import { memo, useRef } from "react";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import { useIsLamplight } from "@/components/lamp/SkinProvider";

const sizeMap = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

// memo (Phase 13) — Loader is held inside every Suspense boundary
// (one per lazy route, plus inline spinners on async sub-trees).
// Without memo, every state change in the parent re-runs Loader's
// framer-motion config calculation. Props are all primitives, so
// the default shallow compare is correct.
function Loader({
  variant = "orbit",
  size = "md",
  className,
  label,
}) {
  const lamp = useIsLamplight();
  // Lamplight: every decorative loader becomes the asymptote. "ring" stays
  // a ring because it lives inside buttons where a curve would not fit.
  if (variant === "asymptote" || (lamp && variant !== "ring")) {
    return <AsymptoteLoader size={size} className={className} label={label} />;
  }

  if (variant === "dots") {
    return (
      <div className={cn("inline-flex items-center gap-3", className)}>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="h-2.5 w-2.5 rounded-full bg-secondary"
              animate={{
                opacity: [0.35, 1, 0.35],
                y: [0, -6, 0],
                scale: [0.9, 1.12, 0.9],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.14,
              }}
            />
          ))}
        </div>
        {label ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-text-muted">
            {label}
          </span>
        ) : null}
      </div>
    );
  }

  if (variant === "ring") {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-block animate-spin rounded-full border-[1.8px]",
          sizeMap[size],
          className,
        )}
        style={{
          borderColor: "var(--color-ring-border)",
          borderTopColor: "currentColor",
        }}
      />
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <span className={cn("relative inline-flex items-center justify-center", sizeMap[size])}>
        <span className="absolute inset-0 rounded-full border border-primary/25" />
        <motion.span
          className="absolute inset-[12%] rounded-full border border-secondary/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
        />
        <motion.span
          className="absolute inset-[28%] rounded-full bg-gradient-to-br from-primary via-secondary to-glow shadow-pulse"
          animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </span>
      {label ? (
        <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-text-muted">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export default memo(Loader);

/* ── Lamplight "asymptote" loader ────────────────────────────────────
 * A y = 1/x curve draws itself toward a dashed asymptote while a lamp
 * dot rides it, forever approaching and never arriving, which is
 * honestly what waiting feels like. Reduced motion: the finished curve
 * with the dot parked near the line.
 */
const ASYM_CURVE = "M3 3 C 14 26, 34 33, 77 35";
const asymSize = { xs: "h-4 w-8", sm: "h-5 w-10", md: "h-8 w-16", lg: "h-12 w-24" };

function AsymptoteLoader({ size = "md", className, label }) {
  const root = useRef(null);

  useGSAP(() => {
    const svg = root.current?.querySelector("svg");
    const path = svg?.querySelector("[data-curve]");
    const dot = svg?.querySelector("[data-dot]");
    if (!path || typeof path.getTotalLength !== "function" || typeof window.matchMedia !== "function") return;
    const len = path.getTotalLength();
    const place = (t) => {
      const p = path.getPointAtLength(len * t);
      dot.setAttribute("cx", p.x);
      dot.setAttribute("cy", p.y);
    };
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: reduce)", () => { place(0.9); });
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const state = { t: 0 };
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.15 });
      tl.to(path, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" })
        .to(state, { t: 0.97, duration: 1.1, ease: "power2.inOut", onUpdate: () => place(state.t) }, 0)
        .to(path, { opacity: 0.25, duration: 0.35, ease: "power1.in" }, 1.15)
        .set(path, { opacity: 1, strokeDashoffset: len })
        .add(() => { state.t = 0; place(0); });
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} role="status" className={cn("inline-flex items-center gap-3", className)}>
      <svg viewBox="0 0 80 40" fill="none" aria-hidden="true" className={cn("overflow-visible", asymSize[size] || asymSize.md)}>
        <line x1="0" y1="38" x2="80" y2="38" stroke="rgb(var(--rule))" strokeWidth="1.6" strokeDasharray="3 4" />
        <path data-curve d={ASYM_CURVE} stroke="rgb(var(--lamp))" strokeWidth="2.4" strokeLinecap="round" />
        <circle data-dot r="3.4" cx="3" cy="3" fill="rgb(var(--lamp))" style={{ filter: "drop-shadow(0 0 4px rgb(var(--lamp)))" }} />
      </svg>
      {label ? (
        <span className="text-[13px] font-medium text-text-muted">{label}</span>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );
}
