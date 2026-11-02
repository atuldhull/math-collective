/**
 * TiltPanel — the standard Lamplight surface.
 *
 * A rounded slate panel that leans a few degrees toward the pointer in
 * 3D and carries a lamp spotlight under the cursor. `lit` warms the
 * border and corner for the one featured panel on a page. `as` lets it
 * render as a Link / button / section.
 */
import { forwardRef, useRef } from "react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";

const TiltPanel = forwardRef(function TiltPanel(
  { as: Tag = "div", lit = false, tilt = true, className, children, onPointerMove, onPointerLeave, ...props },
  forwardedRef,
) {
  const local = useRef(null);
  const setRef = (node) => {
    local.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const canTilt = () =>
    tilt && typeof window !== "undefined"
    && window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches;

  const handleMove = (e) => {
    onPointerMove?.(e);
    const el = local.current;
    if (!el || !canTilt()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--spot-x", `${px * 100}%`);
    el.style.setProperty("--spot-y", `${py * 100}%`);
    gsap.to(el, {
      rotateY: (px - 0.5) * 6, rotateX: (0.5 - py) * 6,
      transformPerspective: 1000, duration: 0.6, ease: "power3.out", overwrite: "auto",
    });
  };
  const handleLeave = (e) => {
    onPointerLeave?.(e);
    if (local.current && canTilt()) {
      gsap.to(local.current, { rotateX: 0, rotateY: 0, duration: 0.9, ease: "elastic.out(1, 0.6)", overwrite: "auto" });
    }
  };

  return (
    <Tag
      ref={setRef}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={cn("lamp-panel lamp-tilt [transform-style:preserve-3d]", lit && "lamp-panel--lit", className)}
      {...props}
    >
      <span aria-hidden="true" className="lamp-spot" />
      {children}
    </Tag>
  );
});

export default TiltPanel;
