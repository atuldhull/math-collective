/**
 * The homepage hero's scroll length, in pixels.
 *
 * One definition, because there were three and they disagreed.
 *
 * HomePage read `--hero-span` to fade its title. MathFieldHero read it to
 * drive the parallax. HeroNarrativeOverlay hard-coded `innerHeight * 5`.
 * While the token happened to be 500vh all three agreed by coincidence, so
 * the duplication was invisible. Shortening the token to 260vh revealed it
 * immediately: the overlay still believed the hero was five screens long, so
 * it was painting story beat two over content that had already scrolled up,
 * and the page showed two headlines stacked on top of each other.
 *
 * The token is the source of truth — it is what sizes the actual spacer
 * element — so everything that maps scroll onto the hero has to read it.
 *
 * @returns {number} pixels of scroll the hero spans, always > 0
 */
export function heroSpanPx() {
  if (typeof window === "undefined") return 0;

  const raw = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--hero-span")
    .trim();

  const vh = parseFloat(raw);
  if (Number.isFinite(vh) && vh > 0) return window.innerHeight * (vh / 100);

  // The token is missing or unparseable (a stylesheet that failed to load,
  // or jsdom in a unit test). Fall back to the declared desktop value rather
  // than to zero, which would make every progress calculation divide by
  // nothing and snap straight to 1.
  return window.innerHeight * 2.6;
}

/**
 * Scroll progress across the hero, clamped to 0..1.
 *
 * @param {number} [span] a span already measured this frame, to avoid
 *        re-reading computed style in a scroll handler
 */
export function heroProgress(span) {
  if (typeof window === "undefined") return 0;
  const range = span ?? heroSpanPx();
  if (!(range > 0)) return 0;
  return Math.min(1, Math.max(0, window.scrollY / range));
}

export default heroSpanPx;
