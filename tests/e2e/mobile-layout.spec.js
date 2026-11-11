/**
 * Mobile layout guards at real phone widths.
 *
 * Two claims from the readiness review are pinned here so they cannot
 * silently come back:
 *
 *   1. The header's controls were said to be pushed past the right edge
 *      at 375px, leaving a logged-out visitor unable to open the
 *      navigation. This WAS real. These tests cleared it anyway, for two
 *      reasons that are both fixed here:
 *
 *        - The contexts had no `hasTouch`, so `(hover: none) and
 *          (pointer: coarse)` never matched and what was under test was
 *          a render no phone ever produces. A rule inside that block
 *          out-specified Tailwind's `.hidden` and forced md:-only
 *          controls back into the header, putting the menu button at
 *          x=458 of a 390px viewport.
 *        - The menu check only read `boundingBox()`. A box is geometry,
 *          not reachability — it is reported for an element that has
 *          been clipped away and cannot be touched. Nothing ever tapped.
 *
 *      The phones below now emulate touch, and the menu test taps the
 *      control and asserts navigation actually opens.
 *
 *   2. `position: sticky` WAS disabled site-wide, and this reproduced
 *      exactly. MainLayout's root carried `overflow-hidden`, which makes
 *      an element a scroll container and silently kills sticky inside
 *      it. Measured at 375px: the sticky site header moved -600px on a
 *      600px scroll, i.e. it scrolled away like static content. Fixed by
 *      switching to `overflow: clip`, which crops identically without
 *      creating a scroll container.
 *
 * These run against the built SPA served by the backend, so remember to
 * `npm run build` after changing frontend source.
 */

/* The callbacks passed to page.evaluate() run inside the BROWSER, not in
   Node, so they legitimately use browser globals that the Node-flavoured
   lint config for tests/ does not know about. */
/* global document, window, getComputedStyle, requestAnimationFrame */

import { test, expect } from "@playwright/test";

const PHONES = [
  { name: "iPhone SE",      width: 375, height: 667 },
  { name: "Android small",  width: 360, height: 800 },
  { name: "iPhone 12 Pro",  width: 390, height: 844 },
  { name: "Pixel-ish",      width: 412, height: 915 },
];

for (const phone of PHONES) {
  test.describe(`${phone.name} (${phone.width}px)`, () => {
    /* hasTouch/isMobile are load-bearing, not decoration: they are what
       makes `(hover: none) and (pointer: coarse)` match. Without them
       this whole file tests a desktop render at a narrow width, which is
       a different stylesheet from the one a phone gets. */
    test.use({
      viewport: { width: phone.width, height: phone.height },
      hasTouch: true,
      isMobile: true,
    });

    test("no horizontal overflow on the homepage", async ({ page }) => {
      await page.goto("/app/");
      await page.waitForLoadState("networkidle");

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      // A couple of pixels of rounding slack; anything more is a real
      // element hanging off the side.
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test("every header control sits inside the viewport", async ({ page }) => {
      await page.goto("/app/");
      await page.waitForLoadState("networkidle");

      const header = page.locator("header").first();
      await expect(header).toBeVisible();

      // Collect anything clickable in the header and check its box.
      const offscreen = await header.evaluate((el, vw) => {
        const bad = [];
        for (const node of el.querySelectorAll("button, a")) {
          const r = node.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;   // hidden
          const style = getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden") continue;
          if (r.right > vw + 1 || r.left < -1) {
            bad.push({
              text: (node.textContent || "").trim().slice(0, 24),
              left: Math.round(r.left),
              right: Math.round(r.right),
            });
          }
        }
        return bad;
      }, phone.width);

      expect(offscreen).toEqual([]);
    });

    test("a menu control is reachable while logged out", async ({ page }) => {
      await page.goto("/app/");
      await page.waitForLoadState("networkidle");

      // Whatever it is called, SOMETHING in the header must open nav.
      const header = page.locator("header").first();
      // The header also carries a theme disclosure, which is a
      // button[aria-expanded] sitting before the menu control in the DOM.
      // A selector list resolves in document order, so .first() used to pick
      // the theme button, tap it, and then ask why no navigation appeared.
      // Prefer a control that names itself a menu; fall back to the generic
      // disclosure only when nothing does.
      const named = header.locator(
        'button[aria-label*="menu" i], [data-testid="menu-toggle"]',
      );
      const toggle = (await named.count())
        ? named.first()
        : header.locator("button[aria-expanded]").first();

      await expect(toggle).toBeVisible();
      const box = await toggle.boundingBox();
      expect(box).not.toBeNull();
      expect(box.x + box.width).toBeLessThanOrEqual(phone.width + 1);
      // Comfortable tap target.
      expect(box.height).toBeGreaterThanOrEqual(36);

      // A box inside the viewport is not the same as a control a thumb
      // can reach, so ask the page what is actually painted at that point
      // before trusting the geometry.
      const atCentre = await page.evaluate(
        ([x, y]) => {
          const el = document.elementFromPoint(x, y);
          if (!el) return "nothing painted at the button's centre";
          return el.closest(
            'button[aria-label*="menu" i], button[aria-expanded], [data-testid="menu-toggle"]',
          )
            ? "toggle"
            : `covered by <${el.tagName.toLowerCase()}>`;
        },
        [box.x + box.width / 2, box.y + box.height / 2],
      );
      expect(atCentre).toBe("toggle");

      // And then actually use it. This is the check that would have
      // caught the off-screen header: tap() refuses an element outside
      // the viewport, where boundingBox() reports one happily.
      const linksBefore = await page.locator("a[href]:visible").count();
      await toggle.tap();
      await expect
        .poll(() => page.locator("a[href]:visible").count(), { timeout: 5000 })
        .toBeGreaterThan(linksBefore);
    });
  });
}

test.describe("position: sticky is not disabled site-wide", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("no ancestor of the header turns into a scroll container", async ({ page }) => {
    await page.goto("/app/");
    await page.waitForLoadState("networkidle");

    // `overflow: hidden` makes an element a scroll container, which
    // silently disables sticky inside it. `clip` crops identically
    // without that side effect. Walk the header's real ancestor chain
    // rather than guessing which element is the layout root.
    const offenders = await page.evaluate(() => {
      const bad = [];
      let el = document.querySelector("header")?.parentElement;
      while (el) {
        const s = getComputedStyle(el);
        if (s.overflowX === "hidden" || s.overflowY === "hidden") {
          bad.push({
            tag: el.tagName,
            cls: String(el.className).slice(0, 60),
            overflow: `${s.overflowX}/${s.overflowY}`,
          });
        }
        el = el.parentElement;
      }
      return bad;
    });

    expect(offenders).toEqual([]);
  });

  test("the site header actually stays put when the page scrolls", async ({ page }) => {
    await page.goto("/app/");
    await page.waitForLoadState("networkidle");

    const result = await page.evaluate(async () => {
      const header = document.querySelector("header");
      if (!header) return null;

      // The bug this pins was never "the header is not sticky" — it was an
      // ancestor silently making sticky impossible. overflow hidden/auto/
      // scroll turns an element into a scroll container, which kills sticky
      // for everything inside it; overflow: clip crops without doing that.
      // Record every ancestor that would do it, whatever the header's own
      // position happens to be, so the fix cannot quietly come back.
      const killers = [];
      for (let el = header.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        const o = getComputedStyle(el);
        for (const axis of ["overflowX", "overflowY"]) {
          if (["hidden", "auto", "scroll"].includes(o[axis])) {
            killers.push((el.tagName.toLowerCase() + (el.className && typeof el.className === "string"
              ? "." + el.className.trim().split(/s+/)[0] : "")) + " " + axis + ":" + o[axis]);
          }
        }
      }

      const position = getComputedStyle(header).position;
      const before = header.getBoundingClientRect().top;
      window.scrollTo(0, 600);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const after = header.getBoundingClientRect().top;
      return { killers, position, scrolled: window.scrollY, moved: after - before };
    });

    expect(result).not.toBeNull();
    // Nothing above the header may create a scroll container.
    expect(result.killers).toEqual([]);
    test.skip(result.scrolled === 0, "page did not scroll");
    // A header that asks to stick has to actually stick. The public layout
    // deliberately lets its header scroll away, so only hold it to its own
    // declared intent. Before the overflow fix a sticky header measured
    // -600 on a 600px scroll.
    if (result.position === "sticky") {
      expect(Math.abs(result.moved)).toBeLessThan(5);
    }
  });
});

