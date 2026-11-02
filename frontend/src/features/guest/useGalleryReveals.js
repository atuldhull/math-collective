import { useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// How far each slot in the ten-frame rhythm floats: wide frames sit close,
// the small offset ones drift deeper, so the wall reads as layered space.
const DEPTH = [0.25, 0.9, 0.55, 0.8, 0.4, 1, 0.6, 0, 0.75, 0.45];

// One observer for the collection; no per-image animation loops or scroll handlers.
export default function useGalleryReveals(root) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const figures = [...root.current.querySelectorAll("[data-gallery-frame]")];
    let observer;
    const sync = () => {
      observer?.disconnect();
      if (media.matches || !window.IntersectionObserver) {
        figures.forEach((figure) => {
          figure.classList.remove("mc-frame-pending");
          figure.classList.add("mc-frame-visible");
        });
        return;
      }
      observer = new window.IntersectionObserver(
        (entries) => {
          entries.forEach(({ target, isIntersecting }) => {
            if (!isIntersecting) return;
            target.classList.add("mc-frame-visible");
            observer.unobserve(target);
          });
        },
        { threshold: 0.06, rootMargin: "40px 0px" },
      );
      figures.forEach((figure) => {
        figure.classList.add("mc-frame-pending");
        observer.observe(figure);
      });
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      observer?.disconnect();
      media.removeEventListener("change", sync);
    };
  }, [root]);

  // Scroll choreography on top of the reveal above. The observer owns each
  // frame's window (clip, fade); GSAP only moves the figure itself, so the
  // two never write the same property. Opacity is never touched here.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          wide: "(min-width: 761px)",
        },
        ({ conditions }) => {
          if (!conditions.motion) return;
          const q = gsap.utils.selector(root);
          const travel = conditions.wide ? 90 : 36;

          // The masthead lands from depth as the intro's portal hands over.
          const heading = q(".mc-gallery-heading")[0];
          if (heading) {
            gsap.from(heading.querySelectorAll("h1, h1 + p, .mc-gallery-index a"), {
              rotateX: -48,
              y: 90,
              z: -160,
              transformPerspective: 1100,
              transformOrigin: "50% 0%",
              stagger: 0.08,
              ease: "none",
              scrollTrigger: { trigger: heading, start: "top 98%", end: "top 30%", scrub: 0.8 },
            });
          }

          q(".mc-gallery-section").forEach((section) => {
            const head = section.querySelector(".mc-section-heading");
            const tl = gsap.timeline({
              defaults: { ease: "none" },
              scrollTrigger: { trigger: head, start: "top 92%", end: "top 40%", scrub: 0.7 },
            });
            tl.from(
              head.querySelector("h2"),
              { xPercent: -14, rotateY: 28, transformPerspective: 800, transformOrigin: "0% 50%", duration: 1 },
              0,
            )
              .from(head.querySelector(":scope > p"), { x: 60, duration: 1 }, 0.1)
              .to(head.querySelector(".mc-gallery-veil-line"), { scaleX: 1, duration: 1 }, 0);
          });

          q("[data-gallery-frame]").forEach((figure) => {
            const depth = DEPTH[Number(figure.dataset.galleryFrame) || 0];
            // Frames tip up off the floor as they arrive…
            gsap.fromTo(
              figure,
              { rotateX: 16, transformPerspective: 1200, transformOrigin: "50% 100%" },
              {
                rotateX: 0,
                ease: "none",
                scrollTrigger: { trigger: figure, start: "top bottom", end: "top 62%", scrub: 0.6 },
              },
            );
            // …and drift at their own depth while you pass them.
            gsap.fromTo(
              figure,
              { y: travel * depth },
              {
                y: -travel * depth,
                ease: "none",
                scrollTrigger: { trigger: figure, start: "top bottom", end: "bottom top", scrub: true },
              },
            );
          });

          // Measured mid route transition; measure again once it settles.
          const refresh = gsap.delayedCall(0.9, () => ScrollTrigger.refresh());
          return () => refresh.kill();
        },
      );
      return () => mm.revert();
    },
    { scope: root },
  );
}
