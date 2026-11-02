import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import gsap from "@/lib/gsap-setup";
import AnimatedCard from "./AnimatedCard";
import FeaturedCard from "./FeaturedCard";

/*
  Canva-style layout: rows of varying compositions.
  Each row is a flex layout with items of different flex ratios.
  Some items are tall (aspect-[3/4]), some wide (aspect-[16/9]),
  some square, some extra-wide — creating an organic, editorial feel.
*/

// Treasure hunt rows — 20 items across creative layouts
const treasureRows = [
  // Row 1: hero full-width (handled by FeaturedCard)
  // Row 2: 3 items — tall | wide | tall
  [{ flex: "1", aspect: "aspect-[3/4]", h: "h-[340px]" }, { flex: "1.6", aspect: "aspect-[16/10]", h: "h-[340px]" }, { flex: "1", aspect: "aspect-[3/4]", h: "h-[340px]" }],
  // Row 3: 2 items — wide landscape | portrait
  [{ flex: "2", aspect: "aspect-[2/1]", h: "h-[280px]" }, { flex: "1", aspect: "aspect-[4/5]", h: "h-[280px]" }],
  // Row 4: 4 items equal
  [{ flex: "1", aspect: "", h: "h-[240px]" }, { flex: "1", aspect: "", h: "h-[240px]" }, { flex: "1", aspect: "", h: "h-[240px]" }, { flex: "1", aspect: "", h: "h-[240px]" }],
  // Row 5: 1 wide panoramic
  [{ flex: "1", aspect: "aspect-[21/9]", h: "h-[260px]" }],
  // Row 6: 3 items — square | tall | square
  [{ flex: "1", aspect: "aspect-square", h: "h-[300px]" }, { flex: "0.8", aspect: "aspect-[3/4]", h: "h-[300px]" }, { flex: "1.2", aspect: "aspect-[4/3]", h: "h-[300px]" }],
  // Row 7: 2 items — big + small stacked feel
  [{ flex: "1.5", aspect: "", h: "h-[320px]" }, { flex: "1", aspect: "", h: "h-[320px]" }],
  // Row 8: 3 final items
  [{ flex: "1", aspect: "", h: "h-[280px]" }, { flex: "1.3", aspect: "", h: "h-[280px]" }, { flex: "0.7", aspect: "", h: "h-[280px]" }],
];

// Inauguration rows — 9 items
const inaugRows = [
  // Row 1: hero (FeaturedCard)
  // Row 2: 2 items
  [{ flex: "1", aspect: "aspect-[4/3]", h: "h-[320px]" }, { flex: "1.4", aspect: "aspect-[16/10]", h: "h-[320px]" }],
  // Row 3: 3 items
  [{ flex: "1", aspect: "", h: "h-[260px]" }, { flex: "1", aspect: "", h: "h-[260px]" }, { flex: "1", aspect: "", h: "h-[260px]" }],
  // Row 4: 2 items tall
  [{ flex: "1.3", aspect: "", h: "h-[340px]" }, { flex: "1", aspect: "aspect-[3/4]", h: "h-[340px]" }],
];

function distributeFiles(files, rows) {
  const result = [];
  let idx = 0;
  for (const row of rows) {
    const rowItems = [];
    for (const config of row) {
      if (idx < files.length) {
        rowItems.push({ file: files[idx], config });
        idx++;
      }
    }
    if (rowItems.length > 0) result.push(rowItems);
  }
  return result;
}

function SectionHeader({ title, subtitle, variant }) {
  const isGold = variant === "gold";
  return (
    <div className="mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h2 data-reveal="up" className="lamp-display break-words text-4xl text-text-primary sm:text-6xl">
          {title}
        </h2>
        {subtitle ? (
          <p data-reveal="up" className="mt-3 text-base leading-7 text-text-muted">{subtitle}</p>
        ) : null}
      </div>
      <span
        data-section-rule
        aria-hidden="true"
        className={`hidden h-px flex-1 origin-left sm:mb-4 sm:ml-10 sm:block ${
          isGold
            ? "bg-[linear-gradient(90deg,rgb(var(--lamp)/0.7),transparent)]"
            : "bg-[linear-gradient(90deg,rgb(var(--violet)/0.75),transparent)]"
        }`}
      />
    </div>
  );
}

/**
 * GallerySection — an editorial collage of one event.
 *
 * A featured photo, then rows of mixed proportions. Motion: each photo
 * settles onto the page with a small spin and scale as its row scrolls
 * in (GSAP batch), alternating direction so the collage feels laid by
 * hand; the heading rule draws with the scroll.
 */
export default function GallerySection({ title, subtitle, label, files, variant, onOpen }) {
  const root = useRef(null);
  const isGold = variant === "gold";
  const rows = isGold ? treasureRows : inaugRows;

  const featured = files[0];
  const rest = files.slice(1);
  const distributed = distributeFiles(rest, rows);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const cells = q("[data-settle]");
      gsap.set(cells, {
        autoAlpha: 0, y: 70, scale: 0.86,
        rotation: (i) => (i % 2 ? 4 : -4) + ((i % 3) - 1) * 1.5,
        transformOrigin: "50% 100%",
      });
      ScrollTrigger.batch(cells, {
        start: "top 92%",
        once: true,
        onEnter: (batch) => gsap.to(batch, {
          autoAlpha: 1, y: 0, scale: 1, rotation: 0,
          duration: 1.2, ease: "back.out(1.3)", stagger: 0.09,
          clearProps: "transform,opacity,visibility",
        }),
      });
      gsap.fromTo(q("[data-section-rule]"), { scaleX: 0 }, {
        scaleX: 1, ease: "none",
        scrollTrigger: { trigger: root.current, start: "top 85%", end: "top 30%", scrub: 0.8 },
      });
    });
    return () => mm.revert();
  }, { scope: root });

  let globalIdx = 1; // start from 1 since 0 is featured

  return (
    <section ref={root} aria-label={title} className="relative mx-auto w-full max-w-[1400px]">
      <SectionHeader title={title} subtitle={subtitle} variant={variant} />

      {/* Featured hero */}
      <FeaturedCard file={featured} label={featured.label || title} sublabel={label} onClick={onOpen} variant={variant} />

      {/* Collage rows */}
      <div className="space-y-3 sm:space-y-4">
        {distributed.map((row, rowIdx) => (
          <div key={rowIdx} className="flex flex-wrap gap-3 sm:flex-nowrap sm:gap-4">
            {row.map(({ file, config }, colIdx) => {
              const idx = globalIdx++;
              // --r drives the flex ratio only at sm+; phones wrap 2-up via basis
              return (
                <div key={colIdx} data-settle className={`${config.h} max-sm:h-44 basis-[calc(50%-0.375rem)] grow rounded-2xl sm:[flex:var(--r)]`} style={{ "--r": config.flex }}>
                  <AnimatedCard
                    file={file}
                    index={idx}
                    onClick={onOpen}
                    variant={variant}
                    size="fill"
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
