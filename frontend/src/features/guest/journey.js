// Pure scroll choreography: deterministic in both directions, independent of idle time.
export const unit = (n) => Math.max(0, Math.min(1, n));
export const ramp = (p, a, b) => {
  const t = unit((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export function journeyState(p) {
  p = unit(p);
  const approach = ramp(p, 0.04, 0.23);
  const emerge = ramp(p, 0.25, 0.39);
  const separate = ramp(p, 0.51, 0.67) * (1 - ramp(p, 0.74, 0.89));
  return {
    progress: p,
    zoom: 1 + 3.8 * approach * (1 - emerge),
    center: approach * (1 - emerge),
    turn: ramp(p, 0.06, 0.48) * 1.9 + ramp(p, 0.5, 0.9) * 2.1,
    wire: ramp(p, 0.28, 0.44) * (1 - ramp(p, 0.86, 0.98)),
    unfold: Math.sin(ramp(p, 0.32, 0.9) * Math.PI) * 0.2,
    separate,
    exit: ramp(p, 0.91, 1),
    hero: 1 - ramp(p, 0.015, 0.13),
    grid: ramp(p, 0.1, 0.25) * (1 - ramp(p, 0.91, 1)),
    scene: p < 0.13 ? "hero" : p < 0.32 ? "enter" : p < 0.53 ? "surface" : p < 0.8 ? "constellation" : "connection",
  };
}
export const journeyChapters = [
  [
    "enter",
    "01 / CHANGE YOUR PERSPECTIVE",
    "Step inside an idea.",
    "A small shift in perspective. An entirely different world.",
    "u ∈ [0, 2π]",
  ],
  [
    "surface",
    "02 / FOLLOW THE SURFACE",
    "One twist.\nOne surface.",
    "Follow a Möbius strip around once: you return with your orientation reversed.",
    "M(u, v) = M(u + 2π, −v)",
  ],
  [
    "constellation",
    "03 / FIND THE RELATIONSHIP",
    "Apart.\nStill connected.",
    "A surface becomes a constellation of cross-sections. Every piece remembers where it belongs.",
    "Ordered sections · one shared structure",
  ],
  [
    "connection",
    "04 / MAKE SOMETHING TOGETHER",
    "Many perspectives.\nOne collective.",
    "Separate ideas come together. That’s where the interesting things begin.",
    "From abstract ideas to real connections ↘",
  ],
];
export function paintJourney(element, state) {
  element.dataset.scene = state.scene;
  element.dataset.progress = state.progress.toFixed(4);
  const style = element.style;
  style.setProperty("--journey-hero", state.hero);
  style.setProperty("--journey-out", state.exit);
  style.setProperty("--journey-grid", state.grid);
  style.setProperty("--journey-progress", state.progress);
  style.setProperty("--journey-travel", `${-state.progress * 90}px`);
  const copy = element.querySelector(".mc-hero-copy");
  if (copy) copy.inert = state.hero < 0.05;
  const footer = element.querySelector(".mc-hero-bottom");
  if (footer) footer.inert = state.hero < 0.05;
  element.querySelectorAll("[data-journey-chapter]").forEach((panel) => {
    const active = panel.dataset.journeyChapter === state.scene;
    panel.setAttribute("aria-hidden", String(!active));
    panel.inert = !active;
  });
}
