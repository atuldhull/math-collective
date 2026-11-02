import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { cloudinaryImg, cloudinaryVideoPoster } from "@/lib/cloudinary";

// Map card size to a sensible Cloudinary target width. The gallery
// cards never exceed ~700px on common viewports — going past 800px
// just wastes bytes for indistinguishable visual quality.
const SIZE_TO_WIDTH = {
  hero:   1200,
  tall:   600,
  wide:   900,
  normal: 600,
  fill:   700,
};

export default function AnimatedCard({ file, index, onClick, variant = "gold", size = "normal" }) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const isGold = variant === "gold";

  // 3D tilt
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(mouseY, [0, 1], [8, -8]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-8, 8]), { stiffness: 200, damping: 20 });
  const glareX = useTransform(mouseX, [0, 1], [0, 100]);
  const glareY = useTransform(mouseY, [0, 1], [0, 100]);

  const handleMouse = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };

  const handleLeave = () => { mouseX.set(0.5); mouseY.set(0.5); };

  const heightMap = { hero: "h-[420px] sm:h-[500px]", tall: "h-[380px] sm:h-[440px]", wide: "h-[220px] sm:h-[260px]", normal: "h-[240px] sm:h-[280px]", fill: "h-full" };
  const spanMap = { hero: "col-span-2 row-span-2", tall: "row-span-2", wide: "col-span-2", normal: "", fill: "" };

  // Lamplight: gold reads as the lamp, purple as the violet ink.
  const hoverBorder = isGold ? "group-hover:border-[rgb(var(--lamp)/0.55)]" : "group-hover:border-[rgb(var(--violet)/0.6)]";
  const glowColor = isGold ? "rgb(var(--lamp)/0.28)" : "rgb(var(--violet)/0.3)";
  const isImg = file.type === "img";

  return (
    // Entrance is driven by the parent section (GSAP settle), so this
    // wrapper only provides perspective for the pointer tilt.
    <div className={`${spanMap[size]} group relative h-full [perspective:800px]`}>
      <motion.div
        ref={ref}
        onMouseMove={handleMouse}
        onMouseLeave={handleLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        whileHover={{ scale: 1.03, boxShadow: `0 20px 60px ${glowColor}` }}
        transition={{ type: "spring", stiffness: 250, damping: 18 }}
        className={`relative ${heightMap[size]} overflow-hidden rounded-2xl border border-[rgb(var(--rule))] bg-surface ${hoverBorder} transition-colors duration-500 ${isImg ? "cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" : ""}`}
        onClick={() => isImg && onClick(file.url)}
        {...(isImg ? {
          role: "button",
          tabIndex: 0,
          "aria-label": `Open photo: ${file.label || `Photo ${index + 1}`}`,
          onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(file.url); } },
        } : {})}
      >
        {/* Shimmer loader */}
        {!loaded && (
          <div className="absolute inset-0 z-30">
            <div className="h-full w-full animate-pulse bg-gradient-to-r from-white/[0.02] via-[rgb(var(--lamp)/0.06)] to-white/[0.02]" />
          </div>
        )}

        {/* Image / Video — Cloudinary URL transforms shrink originals
            from ~3-4 MB down to a few hundred KB at the size we render,
            and serve WebP/AVIF where supported. decoding=async lets
            the browser decode off the main thread. fetchPriority=low
            on non-featured cards so the featured hero gets first dibs. */}
        {file.type === "img" ? (
          <motion.img
            src={cloudinaryImg(file.url, SIZE_TO_WIDTH[size] || 600, { quality: size === "hero" ? "best" : "good" })}
            alt={file.label || `Photo ${index + 1}`}
            loading="lazy"
            decoding="async"
            fetchPriority={size === "hero" ? "high" : "low"}
            onLoad={() => setLoaded(true)}
            className="h-full w-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-[1.08]"
            style={{ transform: "translateZ(0)" }}
          />
        ) : (
          <video
            controls muted playsInline
            preload="metadata"
            poster={cloudinaryVideoPoster(file.url, SIZE_TO_WIDTH[size] || 600) || undefined}
            onLoadedData={() => setLoaded(true)}
            className="h-full w-full object-cover"
          >
            <source src={file.url} type="video/mp4" />
          </video>
        )}

        {/* 3D glare overlay */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: useTransform(
              [glareX, glareY],
              ([gx, gy]) => `radial-gradient(circle at ${gx}% ${gy}%, rgb(var(--lamp)/0.16) 0%, transparent 55%)`
            ),
          }}
        />

        {/* Sweep shine */}
        <div className="pointer-events-none absolute inset-0 z-20 -translate-x-full bg-gradient-to-r from-transparent via-[rgb(var(--lamp)/0.08)] to-transparent transition-transform duration-700 group-hover:translate-x-full" />

        {/* Bottom vignette */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-obsidian/85 via-obsidian/35 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-obsidian/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

        {/* Label */}
        {file.label && (
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 p-4" style={{ transform: "translateZ(30px)" }}>
            <p className="text-[13px] font-medium text-text-primary drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {file.label}
            </p>
          </div>
        )}

        {/* Stop number — only where the photos are a sequence (the hunt) */}
        {isGold && (
          <div className="lamp-numerals pointer-events-none absolute right-3 top-3 z-20 flex h-8 min-w-8 items-center justify-center rounded-full bg-obsidian/75 px-2 text-[12px] text-primary backdrop-blur-sm"
            style={{ transform: "translateZ(20px)" }}>
            {String(index + 1).padStart(2, "0")}
          </div>
        )}

        {/* Video badge */}
        {file.type === "vid" && (
          <div className="pointer-events-none absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-obsidian/75 px-2.5 py-1 text-[12px] font-medium text-text-primary backdrop-blur-sm"
            style={{ transform: "translateZ(20px)" }}>
            <Play className="h-3 w-3 text-primary" strokeWidth={1.75} aria-hidden="true" />
            Video
          </div>
        )}

        {/* Edge glow on hover */}
        <div className={`pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${
          isGold ? "shadow-[inset_0_0_40px_rgb(var(--lamp)/0.1)]" : "shadow-[inset_0_0_40px_rgb(var(--violet)/0.12)]"
        }`} />
      </motion.div>
    </div>
  );
}
