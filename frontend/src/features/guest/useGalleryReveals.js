import { useEffect } from "react";

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
}
