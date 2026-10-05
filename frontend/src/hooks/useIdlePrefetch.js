import { useEffect } from "react";

/**
 * Warm a lazy chunk while the main thread is idle.
 *
 * The problem this solves, measured rather than assumed: scrolling the
 * homepage produced 19 main-thread long tasks totalling ~1.3s, worst case
 * 109ms. Sitting still on the same page with the hero animating produced
 * zero. The tasks lined up exactly with EvolutionTimeline + MathRender +
 * KaTeX (258KB) arriving, because DeferUntilNear starts their fetch on the
 * first scroll — so the browser parses a quarter-megabyte of JavaScript at
 * the precise moment the visitor is asking it to scroll.
 *
 * Deferring the fetch further does not help; it only moves the stall. The
 * fix is to do the work when nothing else needs the thread. requestIdle-
 * Callback exists for exactly this: the browser runs the callback in a gap
 * between frames and yields it back the moment real work arrives.
 *
 * So: DeferUntilNear still decides when the component MOUNTS (which is what
 * keeps it off the critical path for people who never scroll that far).
 * This decides when the module is PARSED. By the time the observer fires,
 * the import resolves from cache with nothing left to compile.
 *
 * @param {() => Promise<unknown>} importer  the same `() => import(...)`
 *        expression passed to React.lazy, so both share one module record
 * @param {{ enabled?: boolean, timeout?: number }} options
 */
export function useIdlePrefetch(importer, { enabled = true, timeout = 2500 } = {}) {
  useEffect(() => {
    if (!enabled || typeof importer !== "function") return undefined;
    if (typeof window === "undefined") return undefined;

    // Save-Data is an explicit request not to spend the visitor's bandwidth
    // on something they have not asked for. A speculative prefetch is the
    // definition of that, so honour it and let the scroll path pay instead.
    try {
      const conn = navigator.connection;
      if (conn?.saveData) return undefined;
      // 2g/slow-2g: the download itself would be the bottleneck and would
      // compete with whatever the page still needs.
      if (typeof conn?.effectiveType === "string" && conn.effectiveType.includes("2g")) {
        return undefined;
      }
    } catch {
      /* navigator.connection is patchily supported; fall through */
    }

    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      // Failures are deliberately swallowed. This is a speculative warm-up;
      // if it fails, DeferUntilNear will import it again for real and that
      // path has its own Suspense boundary and error handling.
      importer().catch(() => {});
    };

    // `timeout` guarantees the callback runs even if the thread never goes
    // properly idle, which is the case on a page with a busy first second.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }

    // Safari has no requestIdleCallback. A timer after first paint is the
    // usual stand-in — later than ideal, still well before a human scrolls
    // two and a half screens.
    const id = window.setTimeout(run, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [importer, enabled, timeout]);
}

export default useIdlePrefetch;
