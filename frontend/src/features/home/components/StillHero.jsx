/**
 * StillHero — a single pre-rendered frame as the hero backdrop.
 *
 * The cheapest of the three hero modes and, on a phone, the best one.
 * The image is an offline Blender render, so it carries lighting and
 * reflections the browser could never compute in real time, and it
 * costs 10–26 KB and zero GPU work per frame. The WebGL hero, by
 * comparison, ships ~550 KB of Three.js and shades a dozen real-time
 * lights over every pixel, 60 times a second, for a scene that is
 * mostly dark anyway.
 *
 * Deliberately NOT scroll-animated. Motion is what the video mode is
 * for; this mode exists precisely for devices and people where motion
 * is the problem.
 *
 * The gradient on top is doing real work: the render is bright through
 * the middle, which is exactly where the hero headline sits, and white
 * text over it was genuinely unreadable. The scrim darkens the centre
 * band so the type has something to sit on.
 */

const SRC_SET = [
  "/app/hero/monument-828.webp 828w",
  "/app/hero/monument-1280.webp 1280w",
  "/app/hero/monument-1920.webp 1920w",
].join(", ");

export default function StillHero() {
  return (
    <div
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}
    >
      <picture>
        <source type="image/webp" srcSet={SRC_SET} sizes="100vw" />
        <img
          src="/app/hero/monument-1280.jpg"
          alt=""
          decoding="async"
          /* eager, not lazy: this is the first thing on the page, and a
             lazy hero is a flash of empty background. */
          fetchPriority="high"
          style={{
            width: "100%", height: "100%",
            objectFit: "cover",
            objectPosition: "center 45%",
            /* The render is a 16:9 frame; on a tall phone viewport
               object-fit crops the sides, which is fine — the monument
               is centred. */
          }}
        />
      </picture>

      {/* Scrim: darken the middle where the headline lands, and deepen
          the bottom so the page content below can rise out of it. */}
      <div
        style={{
          position: "absolute", inset: 0,
          background:
            "linear-gradient(to bottom, rgba(5,3,10,0.55) 0%, rgba(5,3,10,0.35) 30%, rgba(5,3,10,0.60) 65%, rgba(5,3,10,0.95) 100%)",
        }}
      />
    </div>
  );
}
