import { useEffect, useRef, useState } from "react";

/**
 * Render children only once they are close to the viewport.
 *
 * Why this exists: `React.lazy` defers the DOWNLOAD until the component
 * RENDERS — not until it is visible. Putting a lazy component low down
 * the page does nothing on its own; as soon as React walks the tree it
 * mounts, and the chunk is fetched immediately.
 *
 * That bit the homepage. EvolutionTimeline was lazily imported with a
 * comment explaining it sits below the hero spacer so the chunk could
 * load "invisibly" while people scroll. It didn't: it rendered on mount
 * and pulled KaTeX (~253 KB) into every single page load, on phones
 * too, for a formula nobody had scrolled to yet.
 *
 * Wrapping the component in this defers it for real.
 *
 * `rootMargin` starts the fetch before the placeholder is actually on
 * screen, so the content is usually ready by the time it is reached —
 * which is what the original comment intended.
 */
export default function DeferUntilNear({
  children,
  rootMargin = "600px",
  minHeight = 0,
}) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    // No IntersectionObserver (old browser, jsdom in tests): render it
    // rather than hiding content behind a missing API.
    if (typeof window.IntersectionObserver === "undefined") {
      setShow(true);
      return undefined;
    }

    const io = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [show, rootMargin]);

  // The placeholder keeps its slot in the layout so nothing jumps when
  // the real content arrives.
  return <div ref={ref} style={minHeight ? { minHeight } : undefined}>{show ? children : null}</div>;
}
