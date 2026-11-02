import { useEffect } from "react";
import Lenis from "lenis";

export function useSmoothScroll(enabled) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const lenis = new Lenis({
      lerp: 0.085,
      duration: 1.15,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.95,
      // Lenis takes every wheel event for the page by default, so nested
      // scrollers (the sidebar rail, chat, palette, sheets, modals) could
      // only be scrolled with the keyboard. Let any element that can
      // actually scroll keep its own wheel.
      prevent: (node) => {
        if (!(node instanceof HTMLElement)) return false;
        if (node === document.body || node === document.documentElement) return false;
        if (node.hasAttribute("data-lenis-prevent")) return true;
        const { overflowY } = window.getComputedStyle(node);
        return (overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight + 1;
      },
    });

    let frameId = 0;

    const raf = (time) => {
      lenis.raf(time);
      frameId = window.requestAnimationFrame(raf);
    };

    frameId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(frameId);
      lenis.destroy();
    };
  }, [enabled]);
}
