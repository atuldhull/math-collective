import { useEffect } from "react";

// Scroll work exists only after an input/resize and only for visible public sections.
export default function usePublicMotion(root) {
  useEffect(() => {
    const element = root.current;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(pointer: fine)");
    const sections = [...element.querySelectorAll(".mc-section")];
    const metrics = new Map();
    const visible = new Set();
    let frame = 0;
    const render = () => {
      frame = 0;
      if (document.hidden) return;
      for (const section of visible) {
        const { top, height } = metrics.get(section) || { top: 0, height: 1 };
        const progress = media.matches
          ? 1
          : Math.max(
              0,
              Math.min(
                1,
                (window.scrollY + window.innerHeight - top) /
                  Math.min(height + window.innerHeight, window.innerHeight * 1.3),
              ),
            );
        section.style.setProperty("--section-progress", progress);
        section.style.setProperty("--section-rise", (1 - progress) * 48 + "px");
      }
    };
    const schedule = () => {
      if (!frame && !document.hidden) frame = requestAnimationFrame(render);
    };
    const measure = () => {
      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        metrics.set(section, { top: rect.top + window.scrollY, height: rect.height });
      });
      schedule();
    };
    const observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)));
      schedule();
    });
    sections.forEach((section) => observer.observe(section));
    const resize = new window.ResizeObserver(measure);
    resize.observe(element);
    const resets = [];
    element.querySelectorAll(".mc-activity-art").forEach((card) => {
      let bounds;
      const reset = () => {
        card.style.removeProperty("--card-x");
        card.style.removeProperty("--card-y");
      };
      const enter = () => {
        bounds = card.getBoundingClientRect();
      };
      const move = (event) => {
        if (!fine.matches || media.matches || !bounds) return;
        card.style.setProperty("--card-x", String((event.clientX - bounds.left) / bounds.width - 0.5));
        card.style.setProperty("--card-y", String((event.clientY - bounds.top) / bounds.height - 0.5));
      };
      card.addEventListener("pointerenter", enter, { passive: true });
      card.addEventListener("pointermove", move, { passive: true });
      card.addEventListener("pointerleave", reset);
      resets.push(() => {
        card.removeEventListener("pointerenter", enter);
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerleave", reset);
        reset();
      });
    });
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else schedule();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    media.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", visibility);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      resets.forEach((reset) => reset());
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      media.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [root]);
}
