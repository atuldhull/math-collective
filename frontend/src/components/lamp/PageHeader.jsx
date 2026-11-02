/**
 * PageHeader — the opening beat of every Lamplight page.
 *
 * One orchestrated sequence per page: the context line fades up, the
 * title arrives, the asymptote draws itself, then the description and
 * actions settle. How the title arrives differs from page to page
 * (rise, decode, blur, cascade, slide, flip, typewriter), picked from
 * the route so neighbouring pages never open the same way; pass
 * `entrance` to choose one. It starts a beat late so it lands as the
 * route transition uncovers the page.
 */
import { useRef } from "react";
import { useLocation } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import gsap from "@/lib/gsap-setup";
import useHaunted from "./useHaunted";

gsap.registerPlugin(SplitText);

const ENTRANCES = ["rise", "scramble", "blur", "cascade", "slide", "flip", "type"];
// Haunted season: titles stutter on, tremble, or drip into place.
const HAUNTED_ENTRANCES = ["flicker", "shiver", "bleed"];
const SCRAMBLE = "∑∫π∞∂√λφΔ∇θABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Decodes each word from random glyphs into its real text. */
function scrambleIn(tl, words, at) {
  words.forEach((node, i) => {
    const final = node.textContent;
    const state = { p: 0 };
    tl.to(state, {
      p: 1, duration: 0.9, ease: "power2.out",
      onStart: () => { node.style.visibility = "visible"; },
      onUpdate: () => {
        const n = Math.floor(state.p * final.length);
        let out = final.slice(0, n);
        for (let k = n; k < final.length; k++) out += final[k] === " " ? " " : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
        node.textContent = out;
      },
      onComplete: () => { node.textContent = final; },
    }, at + i * 0.08);
  });
}
import { cn } from "@/lib/cn";
import AsymptoteCurve from "./AsymptoteCurve";

/** Masked words for the rise; a word wrapped in *asterisks* gets the
 *  public home's Georgia-italic accent. */
function SplitWords({ text }) {
  return text.split(" ").map((raw, i, all) => {
    const accent = /^\*.+\*[.,!?]*$/.test(raw);
    const word = accent ? raw.replace(/\*/g, "") : raw;
    return (
      <span key={`${raw}-${i}`} className="lamp-word">
        <span data-word className={accent ? "lamp-accent" : undefined}>{word}{i < all.length - 1 ? " " : ""}</span>
      </span>
    );
  });
}

export default function PageHeader({
  context,
  title,
  description,
  actions,
  curve = true,
  progress,
  size = "lg",
  className,
  entrance,
  children,
}) {
  const root = useRef(null);
  const { pathname } = useLocation();
  const haunted = useHaunted();
  const pool = haunted ? HAUNTED_ENTRANCES : ENTRANCES;
  const style = entrance || pool[hash(pathname) % pool.length];

  useGSAP(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const q = gsap.utils.selector(root);
    const words = q("[data-word]");
    const tl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.55 });
    let split = null;
    tl.from(q("[data-ctx]"), { y: 14, autoAlpha: 0, duration: 0.7 });

    if (style === "scramble") {
      gsap.set(words, { visibility: "hidden" });
      scrambleIn(tl, words, 0.05);
    } else if (style === "blur") {
      tl.from(words, { autoAlpha: 0, filter: "blur(14px)", letterSpacing: "0.35em", duration: 1.2, stagger: 0.08, clearProps: "filter,letterSpacing" }, 0.05);
    } else if (style === "flicker") {
      split = SplitText.create(words, { type: "chars" });
      split.chars.forEach((ch) => {
        tl.fromTo(ch, { opacity: 0 }, {
          keyframes: [
            { opacity: 1, duration: 0.04 }, { opacity: 0, duration: 0.07 },
            { opacity: 0.6, duration: 0.05 }, { opacity: 0.1, duration: 0.09 }, { opacity: 1, duration: 0.05 },
          ],
          ease: "steps(1)",
        }, gsap.utils.random(0.05, 0.9));
      });
    } else if (style === "shiver") {
      tl.from(words, { y: -50, autoAlpha: 0, duration: 0.7, ease: "power4.out", stagger: 0.07 }, 0.05)
        .to(words, { x: () => gsap.utils.random(-3, 3), y: () => gsap.utils.random(-2, 2), duration: 0.05, repeat: 14, yoyo: true, ease: "none", repeatRefresh: true }, 0.7)
        .set(words, { x: 0, y: 0 });
    } else if (style === "bleed") {
      split = SplitText.create(words, { type: "chars" });
      tl.from(split.chars, { yPercent: -140, scaleY: 2.2, transformOrigin: "50% 0%", autoAlpha: 0, duration: 1.1, ease: "elastic.out(1, 0.45)", stagger: { each: 0.04, from: "random" } }, 0.05);
    } else if (style === "cascade" || style === "type") {
      split = SplitText.create(words, { type: "chars" });
      if (style === "cascade") {
        tl.from(split.chars, { yPercent: -160, rotate: () => gsap.utils.random(-40, 40), autoAlpha: 0, duration: 0.9, ease: "back.out(1.6)", stagger: { each: 0.025, from: "random" } }, 0.05);
      } else {
        tl.from(split.chars, { autoAlpha: 0, duration: 0.01, stagger: 0.045, ease: "none" }, 0.1)
          .fromTo(q("[data-caret]"), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.4, repeat: 5, yoyo: true, ease: "steps(1)" }, 0.1)
          .set(q("[data-caret]"), { display: "none" });
      }
    } else if (style === "slide") {
      tl.from(words, { x: 140, skewX: -25, autoAlpha: 0, duration: 1, stagger: 0.07 }, 0.05);
    } else if (style === "flip") {
      tl.from(words, { rotateX: -100, transformOrigin: "50% 100%", transformPerspective: 600, autoAlpha: 0, duration: 1, ease: "back.out(1.4)", stagger: 0.08 }, 0.05);
    } else {
      tl.from(words, { yPercent: 115, rotate: 4, duration: 1.1, stagger: 0.06 }, 0.08);
    }

    tl.from(q("[data-desc]"), { y: 18, autoAlpha: 0, duration: 0.9 }, 0.35)
      .from(q("[data-actions] > *"), { y: 16, autoAlpha: 0, scale: 0.96, duration: 0.8, stagger: 0.07 }, 0.45)
      .from(q("[data-rule]"), { scaleX: 0, transformOrigin: "left center", duration: 1.4 }, 0.2)
      .from(q("[data-extra]"), { y: 14, autoAlpha: 0, duration: 0.8 }, 0.55);

    return () => split?.revert();
  }, { scope: root, dependencies: [style] });


  const titleSize = size === "sm"
    ? "text-[1.9rem] sm:text-4xl"
    : "text-[2.35rem] leading-[1.02] sm:text-5xl lg:text-[3.6rem]";

  return (
    <header ref={root} className={cn("relative mb-8 sm:mb-10", className)}>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          {context ? (
            <p data-ctx className="mb-3 text-sm font-medium text-text-muted">{context}</p>
          ) : null}
          <h1 data-page-title className={cn("lamp-display text-text-primary", titleSize)} style={{ textWrap: "balance" }}>
            {typeof title === "string" ? <SplitWords text={title} /> : title}
            {style === "type" ? <span data-caret aria-hidden="true" className="ml-1 inline-block h-[0.8em] w-[3px] translate-y-[0.08em] bg-primary opacity-0" /> : null}
          </h1>
          {description ? (
            <p data-desc className="mt-4 max-w-[62ch] text-base leading-7 text-text-muted sm:text-[1.0625rem]">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-start gap-4 lg:items-end">
          {curve ? <AsymptoteCurve progress={progress} className="hidden h-16 w-60 lg:block" /> : null}
          {actions ? <div data-actions className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      </div>
      <div data-rule className="mt-7 h-px w-full bg-[linear-gradient(90deg,rgb(var(--lamp)/0.55),rgb(var(--rule))_30%,rgb(var(--rule))_80%,transparent)]" />
      {children ? <div data-extra className="mt-6">{children}</div> : null}
    </header>
  );
}
