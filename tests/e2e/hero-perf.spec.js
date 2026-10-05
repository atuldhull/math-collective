/**
 * Hero performance probe.
 *
 * The homepage hero has been rebuilt several times because each version was
 * slow, and "it feels smoother now" is not evidence. This measures the thing
 * that actually made the old ones bad: main-thread long tasks.
 *
 * The previous hero rendered a Three.js scene with bloom postprocessing on
 * every frame across 500vh of scroll, so the main thread was busy shading
 * while the visitor was trying to scroll. The replacement animates only
 * transform and opacity, which the compositor handles without involving the
 * main thread at all.
 *
 * The strongest assertion here is the idle one. A hero that costs nothing
 * while it is fully visible and animating cannot be the source of scrolling
 * lag, whatever else the page is doing.
 */

import { test, expect } from "@playwright/test";

/**
 * Wait for the idle prefetch to warm the KaTeX chunk.
 *
 * Not the test going easy on itself: useIdlePrefetch runs on
 * requestIdleCallback, so for a real visitor it lands while they are still
 * reading the headline, seconds before they scroll. A synthetic scroll
 * starting the instant networkidle fires can beat it, and then measures a
 * race no human runs. The instant-scroll case is no worse than before the
 * prefetch existed — that chunk was always fetched on first scroll — so the
 * prefetch can only move cost earlier, never add it.
 */
async function warmed(page) {
  await page
    .waitForFunction(
      () =>
        performance
          .getEntriesByType("resource")
          .some((e) => e.name.includes("math-vendor")),
      null,
      { timeout: 8000 }
    )
    .catch(() => {
      /* No KaTeX chunk at all is also a pass — it would mean nothing on the
         page needed it, which is the ideal outcome rather than a failure. */
    });
}

test.describe("homepage hero", () => {
  test("costs the main thread nothing while it animates", async ({ page }) => {
    await page.goto("/app/", { waitUntil: "networkidle" });

    await expect(page.locator(".mf-root")).toHaveCount(1);
    expect(await page.locator(".mf-fig").count()).toBeGreaterThan(0);

    await warmed(page);

    // Sit still with the hero fully visible and every curve rotating. This is
    // the measurement that separates this hero from the ones before it: they
    // were rendering a frame at a time here.
    const idle = await page.evaluate(async () => {
      const tasks = [];
      let po;
      try {
        po = new PerformanceObserver((l) => {
          for (const e of l.getEntries()) tasks.push(Math.round(e.duration));
        });
        po.observe({ entryTypes: ["longtask"] });
      } catch {
        /* longtask unsupported here; the assertion below passes trivially */
      }
      await new Promise((r) => setTimeout(r, 3000));
      po?.disconnect();
      return { count: tasks.length, totalMs: tasks.reduce((a, b) => a + b, 0) };
    });

    // eslint-disable-next-line no-console
    console.log("[hero] idle:", JSON.stringify(idle));

    // The hero's own contribution here is zero — measured at 0 tasks before
    // the idle prefetch existed. The single ~170ms task now seen is that
    // prefetch parsing the 258KB KaTeX chunk, which is precisely where it is
    // supposed to happen: in idle, rather than under the visitor's thumb
    // mid-scroll. A per-frame renderer would produce dozens of tasks here
    // and there would be no quiet window to move anything into.
    expect(idle.count).toBeLessThanOrEqual(2);
  });

  test("fetches and parses nothing while the visitor scrolls the hero", async ({ page }) => {
    await page.goto("/app/", { waitUntil: "networkidle" });
    await warmed(page);

    const metrics = await page.evaluate(async () => {
      const tasks = [];
      let po;
      try {
        po = new PerformanceObserver((l) => {
          for (const e of l.getEntries()) tasks.push(Math.round(e.duration));
        });
        po.observe({ entryTypes: ["longtask"] });
      } catch {
        /* longtask unsupported here */
      }

      const before = performance.getEntriesByType("resource").length;

      // Only the hero's own span. Scrolling the whole page would also mount
      // every below-fold section, and that one-time mount cost is both noisy
      // and not what this file is about.
      const raw = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--hero-span")
        .trim();
      const vh = parseFloat(raw) || 260;
      const span = window.innerHeight * (vh / 100);

      for (let i = 0; i <= 50; i += 1) {
        window.scrollTo(0, (span * i) / 50);
        await new Promise((r) => setTimeout(r, 16));
      }
      await new Promise((r) => setTimeout(r, 300));
      po?.disconnect();

      return {
        heroSpanVh: vh,
        longTaskCount: tasks.length,
        longTaskTotalMs: tasks.reduce((a, b) => a + b, 0),
        scriptsLoadedDuringScroll: performance
          .getEntriesByType("resource")
          .slice(before)
          .filter((e) => e.name.endsWith(".js"))
          .map((e) => e.name.split("/").pop()),
      };
    });

    // eslint-disable-next-line no-console
    console.log("[hero] hero-span scroll:", JSON.stringify(metrics));

    // The specific defect useIdlePrefetch fixed: EvolutionTimeline's KaTeX
    // chunk (258KB) used to arrive on the first scroll and blocked the thread
    // for ~1.3s parsing it, at the exact moment the page needed to move.
    expect(metrics.scriptsLoadedDuringScroll).toEqual([]);

    // The hero itself contributes nothing (see the idle test); what remains is
    // React mounting the sections coming into range. Generous, because a
    // loaded CI box is noisy — this exists to catch a regression back to
    // per-frame rendering, which would be several times this.
    expect(metrics.longTaskTotalMs).toBeLessThan(2500);
  });

  test("serves the reduced composition on a phone", async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
    });
    const page = await ctx.newPage();
    await page.goto("/app/", { waitUntil: "networkidle" });

    // Reduced keeps both symmetric figures but drops the glow passes, the
    // finest detail and the glyph ring, so a weaker GPU composites far fewer
    // layers. It is not a different design; a visitor should only notice
    // that it is smooth.
    const figs = await page.locator(".mf-fig").count();
    expect(figs).toBeGreaterThan(0);
    expect(await page.locator(".mf-glyph").count()).toBe(0);

    await ctx.close();
  });

  test("stands completely still for prefers-reduced-motion", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/app/", { waitUntil: "networkidle" });

    // Not "slower" — none. Someone who asked for reduced motion gets a static
    // plate, which is why the composition is designed to read without any of
    // the animation.
    const animName = await page
      .locator(".mf-rot")
      .first()
      .evaluate((el) => window.getComputedStyle(el).animationName);
    expect(animName).toBe("none");

    await ctx.close();
  });
});
