import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import { cloudinaryImg } from "@/lib/cloudinary";

/**
 * FeaturedCard — the lead photo of a gallery section.
 *
 * The frame opens like a lamp being turned up: a clipped inset widens
 * to the full card as it scrolls in (GSAP, scrubbed), while the photo
 * drifts inside it on a slower parallax (framer useScroll).
 */
export default function FeaturedCard({ file, label, sublabel, onClick, variant = "gold" }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], [-40, 40]);
  const isGold = variant === "gold";
  const isImg = file.type === "img";

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(ref.current,
        { clipPath: "inset(9% 7% 9% 7% round 1.5rem)" },
        {
          clipPath: "inset(0% 0% 0% 0% round 1.5rem)",
          ease: "none",
          scrollTrigger: { trigger: ref.current, start: "top 95%", end: "top 35%", scrub: 0.7 },
        });
      gsap.from(ref.current.querySelectorAll("[data-feature-text] > *"), {
        y: 28, autoAlpha: 0, duration: 1, ease: "expo.out", stagger: 0.08,
        scrollTrigger: { trigger: ref.current, start: "top 55%", once: true },
      });
    });
    return () => mm.revert();
  }, { scope: ref });

  return (
    <div
      ref={ref}
      className={`group relative mb-10 overflow-hidden rounded-3xl border transition-[border-color,box-shadow] duration-500 ${
        isGold
          ? "border-[rgb(var(--lamp)/0.3)] hover:border-[rgb(var(--lamp)/0.55)] hover:shadow-[0_30px_80px_-20px_rgb(var(--lamp)/0.35)]"
          : "border-[rgb(var(--violet)/0.3)] hover:border-[rgb(var(--violet)/0.6)] hover:shadow-[0_30px_80px_-20px_rgb(var(--violet)/0.4)]"
      } ${isImg ? "cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" : ""}`}
      onClick={() => isImg && onClick(file.url)}
      {...(isImg ? {
        role: "button",
        tabIndex: 0,
        "aria-label": `Open photo: ${label}`,
        onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(file.url); } },
      } : {})}
    >
      <div className="relative h-[300px] overflow-hidden sm:h-[440px] lg:h-[520px]">
        <motion.img
          src={cloudinaryImg(file.url, 1400, { quality: "best" })}
          alt={label}
          loading="lazy"
          decoding="async"
          fetchPriority="high"
          style={{ y: imgY }}
          className="h-[120%] w-full object-cover transition-transform duration-[1s] group-hover:scale-105"
        />
        {/* Ink wash so the title stays legible */}
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian/50 to-transparent" />
      </div>

      {/* Content overlay */}
      <div data-feature-text className="absolute bottom-0 left-0 right-0 z-10 p-6 sm:p-10">
        {sublabel && (
          <p className={`text-sm font-medium ${isGold ? "text-primary" : "text-secondary"}`}>{sublabel}</p>
        )}
        <h3 className="lamp-display mt-2 text-4xl text-text-primary sm:text-5xl">
          {label}
        </h3>
      </div>
    </div>
  );
}
