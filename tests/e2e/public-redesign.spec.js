/* global document, window */
import { test, expect } from "@playwright/test";
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  // Visual QA uses the real assets separately; contract tests should not
  // depend on third-party font/media CDNs or send requests off-machine.
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const data =
      {
        "/api/auth/me": { loggedIn: false },
        "/api/csrf-token": { csrfToken: "local-test-token" },
        "/api/events/settings": { registrations_open: "true", banner_enabled: "false" },
        "/api/stats/public": { members: 42, challenges: 12, events: 3, submissions: 80 },
        "/api/events": [],
        "/api/leaderboard": [],
        "/api/leaderboard/alltime": [],
        "/api/leaderboard/winners": [],
      }[path] ?? {};
    await route.fulfill({ json: data });
  });
});

test("responsive home, live totals, navigation and reduced motion", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Curiosity has no limits/ })).toBeVisible();
  await expect(page.locator(".mc-stats")).toContainText("42");
  await expect(page.locator(".mc-sculpture canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause sculpture animation" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  }
  await page.getByRole("link", { name: "Find your people" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Full Name", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("sculpture pause stops rendering and resumes", async ({ page }) => {
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Pause sculpture animation" }).click();
  const snapshot = () => page.locator(".mc-sculpture canvas").evaluate((canvas) => canvas.toDataURL());
  const paused = await snapshot();
  await page.waitForTimeout(200);
  expect(await snapshot()).toBe(paused);
  await page.getByRole("button", { name: "Play sculpture animation" }).click();
  await expect.poll(snapshot).not.toBe(paused);
});

test("code sign-in uses existing request contract", async ({ page }) => {
  let submitted;
  let verified;
  await page.route("**/api/auth/signin-code/request", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { message: "Check your inbox for your sign-in code." } });
  });
  await page.route("**/api/auth/signin-code/verify", async (route) => {
    verified = route.request().postDataJSON();
    await route.fulfill({
      json: { user: { id: "test-member", name: "Test Student", role: "student" }, redirectTo: "/events" },
    });
  });
  await page.goto("/app/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/college email/i).fill("student@bmsit.in");
  await page.getByRole("button", { name: "Email me a code", exact: true }).click();
  await expect(page.getByLabel(/^Sign-in code/)).toBeVisible();
  expect(submitted).toEqual({ email: "student@bmsit.in" });
  await page.getByLabel(/^Sign-in code/).fill("12345678");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.locator(".mc-public")).toHaveCount(0);
  expect(verified).toEqual({ email: "student@bmsit.in", token: "12345678" });
});

test("password login switches to original member UI, logout restores guest design", async ({ page }) => {
  const user = { id: "test-member", name: "Test Member", role: "student", email: "student@bmsit.in" };
  let submitted;
  await page.route("**/api/auth/login", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { user, redirectTo: "/events" } });
  });
  await page.goto("/app/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /password instead/i }).click();
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("Test-password-123!");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.locator(".mc-public")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Event Timeline/ })).toBeVisible();
  expect(submitted).toEqual({ email: user.email, password: "Test-password-123!" });
  // Use the existing compact account menu to exercise the same logout
  // handler without depending on the legacy desktop header's wide layout.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await page
    .getByRole("button", { name: /sign out/i })
    .last()
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".mc-public")).toBeVisible();
});

test("public routes render without overflow or runtime failures", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of ["events", "leaderboard", "gallery", "contact", "verify", "reset-password"]) {
    await test.step(path, async () => {
      await page.goto(`/app/${path}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".mc-public")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), path).toBe(true);
    });
  }
  expect(errors).toEqual([]);
});

test("registration retains validation and request format", async ({ page }) => {
  let submitted;
  await page.route("**/api/auth/register", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { message: "Registered" } });
  });
  await page.goto("/app/register", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Full Name", { exact: true }).fill("Test Student");
  await page.getByLabel("Email", { exact: true }).fill("student@bmsit.in");
  await page.getByLabel("Password", { exact: true }).fill("Test-password-123!");
  await page.getByLabel("Confirm Password", { exact: true }).fill("different");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(page.getByText("Passwords do not match", { exact: true })).toBeVisible();
  expect(submitted).toBeUndefined();
  await page.getByLabel("Confirm Password", { exact: true }).fill("Test-password-123!");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(submitted).toEqual({ name: "Test Student", email: "student@bmsit.in", password: "Test-password-123!" });
});

test("contact form retains its existing API integration", async ({ page }) => {
  let submitted;
  await page.route("**/api/contact/send", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { message: "Sent" } });
  });
  await page.goto("/app/contact", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Name", { exact: true }).fill("Test Student");
  await page.getByLabel("Email", { exact: true }).fill("student@example.com");
  await page.getByLabel("Subject", { exact: true }).fill("Club question");
  await page.getByLabel("Message", { exact: true }).fill("A local test message.");
  await page.getByRole("button", { name: "Send Message", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Message Sent!" })).toBeVisible();
  expect(submitted).toEqual({
    name: "Test Student",
    email: "student@example.com",
    subject: "Club question",
    message: "A local test message.",
  });
});

test("gallery preserves photos, videos and keyboard lightbox controls", async ({ page }) => {
  await page.goto("/app/gallery", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".mc-gallery-grid figure")).toHaveCount(29);
  await expect(page.locator(".mc-gallery-grid video")).toHaveCount(5);
  const thumbnail = page.getByRole("button", { name: "Open Treasure Hunt: Start", exact: true });
  await thumbnail.click();
  await expect(page.getByRole("dialog", { name: "Club photo viewer" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".mc-gallery-dialog-controls p")).toContainText("Clue I");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(thumbnail).toBeFocused();
});

test("four public themes persist across routes and leave the member theme untouched", async ({ page }) => {
  const errors = [];
  const audioRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/app/audio/")) audioRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  const originalTheme = await page.locator("html").getAttribute("data-theme");
  const palettes = [];
  for (const [id, name] of [
    ["obsidian", "Obsidian"],
    ["arctic", "Arctic"],
    ["emerald", "Emerald Matrix"],
    ["nebula", "Nebula"],
  ]) {
    await page.getByRole("button", { name: /^Appearance:/ }).click();
    await page.getByRole("radio", { name: new RegExp(name) }).check();
    await expect(page.locator("[data-public-theme]")).toHaveAttribute("data-public-theme", id);
    await expect(page.getByRole("radio", { name: new RegExp(name) })).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: `Appearance: ${name}` })).toBeFocused();
    palettes.push(
      await page.locator(".mc-public-theme").evaluate((el) => getComputedStyle(el).getPropertyValue("--mc-paper")),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-public-theme]")).toHaveAttribute("data-public-theme", id);
  }
  expect(new Set(palettes).size).toBe(4);
  await expect(page.locator("body")).not.toHaveAttribute("data-monument");
  await page.getByRole("link", { name: "Find your people" }).click();
  await expect(page.getByLabel("Full Name", { exact: true })).toBeVisible();
  await expect(page.locator("[data-public-theme]")).toHaveAttribute("data-public-theme", "nebula");
  expect(await page.locator("html").getAttribute("data-theme")).toBe(originalTheme);
  expect(audioRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("hero caption and scroll link never collide at narrow or short viewports", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  for (const width of [320, 560, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 600 });
    await expect(page.locator(".mc-sculpture figcaption")).toBeVisible();
    const caption = await page.locator(".mc-sculpture figcaption").boundingBox();
    const footer = await page.locator(".mc-hero-bottom").boundingBox();
    expect(caption.y + caption.height).toBeLessThanOrEqual(footer.y + 1);
    const header = await page.locator(".mc-header-actions").boundingBox();
    expect(header.x + header.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("scroll story changes geometry and reduced motion freezes the composition", async ({ page }) => {
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  const story = page.locator(".mc-math-story");
  const position = await story.evaluate((el) => ({
    top: el.getBoundingClientRect().top + window.scrollY,
    height: el.offsetHeight,
  }));
  const curve = page.locator(".mc-curve-path");
  await page.evaluate((top) => window.scrollTo(0, top), position.top);
  await expect(page.locator(".mc-story-meter")).toContainText("TRANSFORMATION");
  const first = await curve.getAttribute("d");
  await page.evaluate(
    (top) => window.scrollTo(0, top),
    position.top + (position.height - page.viewportSize().height) * 0.8,
  );
  await expect.poll(() => curve.getAttribute("d")).not.toBe(first);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await story.scrollIntoViewIfNeeded();
  await expect(page.locator(".mc-story-meter")).toContainText("REDUCED MOTION");
  const still = await curve.getAttribute("d");
  await page.mouse.wheel(0, 200);
  await expect(curve).toHaveAttribute("d", still);
});

test("sculpture stops drawing outside the viewport and guest assistant keeps sign-in boundary", async ({ page }) => {
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".mc-sculpture canvas")).toBeVisible();
  await page.locator(".mc-footer").scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const snapshot = () => page.locator(".mc-sculpture canvas").evaluate((canvas) => canvas.toDataURL());
  const first = await snapshot();
  await page.waitForTimeout(200);
  expect(await snapshot()).toBe(first);
  await page.getByRole("button", { name: "Toggle PANDA AI" }).click();
  await expect(page.getByRole("dialog", { name: "Meet PANDA." })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Toggle PANDA AI" })).toBeFocused();
});

test("sculpture drag captures the pointer, releases with inertia, and returns to idle", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop pointer behavior; native touch is checked separately.");
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  const canvas = page.getByRole("button", { name: "Interactive Möbius sculpture" });
  const figure = page.locator(".mc-sculpture");
  await expect(page.getByRole("button", { name: "Pause sculpture animation" })).toBeVisible();
  const box = await canvas.boundingBox();
  const x = box.x + box.width * 0.5,
    y = box.y + box.height * 0.5;
  await page.mouse.move(x, y);
  await expect(figure).toHaveAttribute("data-interaction", "hover");
  await page.mouse.down();
  await page.mouse.move(x + 110, y + 45, { steps: 12 });
  await expect(figure).toHaveAttribute("data-interaction", "dragging");
  expect(await canvas.evaluate((el) => getComputedStyle(el).cursor)).toBe("grabbing");
  // Capture keeps the gesture alive even outside the interaction rectangle.
  await page.mouse.move(box.x - 20, y, { steps: 8 });
  await expect(figure).toHaveAttribute("data-interaction", "dragging");
  await page.mouse.up();
  await expect(figure).toHaveAttribute("data-interaction", "settling");
  const released = await canvas.evaluate((el) => el.toDataURL());
  await expect.poll(() => canvas.evaluate((el) => el.toDataURL())).not.toBe(released);
  await expect(figure).toHaveAttribute("data-interaction", "idle");
  await canvas.click();
  await expect(figure).toHaveAttribute("data-interaction", "pulse");
  await page.mouse.move(0, 0);
  await expect(figure).toHaveAttribute("data-interaction", "idle");
});

test("paused sculpture supports deliberate rotation without restarting animation or losing its pose", async ({
  page,
}) => {
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  const canvas = page.getByRole("button", { name: "Interactive Möbius sculpture" });
  await page.getByRole("button", { name: "Pause sculpture animation" }).click();
  const picture = () => canvas.evaluate((el) => el.toDataURL());
  const start = await picture();
  await canvas.focus();
  await canvas.press("ArrowRight");
  await canvas.press("ArrowUp");
  await expect.poll(picture).not.toBe(start);
  const turned = await picture();
  await page.waitForTimeout(250);
  expect(await picture()).toBe(turned);
  // A palette round trip preserves the manually chosen orientation.
  await page.getByRole("button", { name: /^Appearance:/ }).click();
  await page.getByRole("radio", { name: /Arctic/ }).check();
  await page.getByRole("radio", { name: /Obsidian/ }).check();
  await page.keyboard.press("Escape");
  await expect.poll(picture).toBe(turned);
  await page.getByRole("button", { name: "Play sculpture animation" }).click();
  await expect.poll(picture).not.toBe(turned);
});

test("reduced motion stays static until explicit keyboard input and suspends when hidden", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  const canvas = page.getByRole("button", { name: "Interactive Möbius sculpture" });
  const figure = page.locator(".mc-sculpture");
  await canvas.scrollIntoViewIfNeeded();
  await expect(figure).toHaveAttribute("data-motion", "still");
  const picture = () => canvas.evaluate((el) => el.toDataURL());
  await page.waitForTimeout(80);
  const start = await picture();
  await canvas.hover();
  await page.waitForTimeout(200);
  expect(await picture()).toBe(start);
  await canvas.press("ArrowLeft");
  await expect.poll(picture).not.toBe(start);
  const turned = await picture();
  await page.waitForTimeout(250);
  expect(await picture()).toBe(turned);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(figure).toHaveAttribute("data-motion", "running");
  // Simulate the browser visibility signal without freezing the test runner.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(figure).toHaveAttribute("data-motion", "suspended");
  const hidden = await picture();
  await page.waitForTimeout(200);
  expect(await picture()).toBe(hidden);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(figure).toHaveAttribute("data-motion", "running");
  await expect.poll(picture).not.toBe(hidden);
});

test("native touch rotates horizontally, taps pulse, and vertical swipes scroll normally", async ({
  page,
  context,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile browser-native touch gestures.");
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  const canvas = page.getByRole("button", { name: "Interactive Möbius sculpture" });
  const figure = page.locator(".mc-sculpture");
  await expect(page.getByRole("button", { name: "Pause sculpture animation" })).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  const x = box.x + box.width * 0.4,
    y = box.y + box.height * 0.77;
  const session = await context.newCDPSession(page);
  const touch = (type, px, py) =>
    session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: px, y: py, id: 1, radiusX: 5, radiusY: 5, force: 1 }],
    });
  const scroll = await page.evaluate(() => window.scrollY);
  await touch("touchStart", x, y);
  for (let i = 1; i <= 8; i++) {
    await touch("touchMove", x + i * 12, y + 2);
    await page.waitForTimeout(20);
  }
  await expect(figure).toHaveAttribute("data-interaction", "dragging");
  await touch("touchEnd");
  await expect(figure).toHaveAttribute("data-interaction", "settling");
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scroll)).toBeLessThan(3);
  await touch("touchStart", x, y);
  await touch("touchEnd");
  await expect(figure).toHaveAttribute("data-interaction", "pulse");
  await touch("touchStart", x, y);
  for (let i = 1; i <= 8; i++) {
    await touch("touchMove", x, y - i * 18);
    await page.waitForTimeout(20);
  }
  await touch("touchEnd");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scroll + 40);
  await expect(figure).not.toHaveAttribute("data-interaction", "dragging");
  await session.detach();
});

test("cinematic journey scrubs forward and backward, reconstructs, and skips to real content", async ({ page }) => {
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Pause sculpture animation" }).click();
  const journey = page.locator(".mc-journey");
  const figure = page.locator(".mc-sculpture");
  const metrics = await journey.evaluate((el) => {
    const hero = el.querySelector(".mc-hero");
    return {
      top: el.getBoundingClientRect().top + window.scrollY,
      travel: el.offsetHeight - hero.offsetHeight,
      pin: Math.min(0, window.innerHeight - hero.offsetHeight),
    };
  });
  const scroll = async (p) => {
    await page.evaluate(({ m, p }) => window.scrollTo(0, m.top - m.pin + m.travel * p), { m: metrics, p });
    await expect.poll(async () => Number(await journey.getAttribute("data-progress"))).toBeCloseTo(p, 2);
  };
  const snapshot = () => figure.locator("canvas").evaluate((el) => el.toDataURL());
  await scroll(0.21);
  await expect(journey).toHaveAttribute("data-scene", "enter");
  await expect(page.getByRole("heading", { name: "Step inside an idea." })).toBeVisible();
  const zoom = await snapshot();
  await scroll(0.45);
  await expect(journey).toHaveAttribute("data-scene", "surface");
  const chamber = await snapshot();
  expect(chamber).not.toBe(zoom);
  await scroll(0.7);
  await expect(journey).toHaveAttribute("data-scene", "constellation");
  await expect(figure).toHaveAttribute("data-separation", "1.000");
  expect(await snapshot()).not.toBe(chamber);
  await scroll(0.92);
  await expect(journey).toHaveAttribute("data-scene", "connection");
  await expect(figure).toHaveAttribute("data-separation", "0.000");
  await scroll(0.45);
  expect(await snapshot()).toBe(chamber);
  await scroll(0.21);
  expect(await snapshot()).toBe(zoom);
  await page.getByRole("link", { name: "Skip to the collective" }).click();
  await expect(page.locator("#collective")).toBeInViewport();
  expect(await page.locator(".mc-journey canvas").count()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("reduced motion removes cinematic pinning and restores readable static content", async ({ page }) => {
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Pause sculpture animation" })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const sizes = await page.locator(".mc-journey").evaluate((el) => ({
    journey: el.offsetHeight,
    hero: el.querySelector(".mc-hero").offsetHeight,
    position: getComputedStyle(el.querySelector(".mc-hero")).position,
  }));
  expect(Math.abs(sizes.journey - sizes.hero)).toBeLessThan(2);
  expect(sizes.position).not.toBe("sticky");
  await expect(page.getByRole("link", { name: "Find your people" })).toBeVisible();
  await expect(page.locator(".mc-cinematic-copy")).toBeHidden();
  await page.locator(".mc-invitation").scrollIntoViewIfNeeded();
  await expect(page.getByRole("link", { name: "Join Asymptotes", exact: true })).toBeVisible();
  await expect(page.locator(".mc-signature")).toBeVisible();
});

test("fast native-scroll jumps preserve active scenes and interaction under CPU throttling", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Pause sculpture animation" })).toBeVisible();
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  try {
    for (const progress of [0.96, 0.18, 0.71, 0.43]) {
      await page.locator(".mc-journey").evaluate((el, p) => {
        const hero = el.querySelector(".mc-hero");
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(
          0,
          top - Math.min(0, window.innerHeight - hero.offsetHeight) + (el.offsetHeight - hero.offsetHeight) * p,
        );
      }, progress);
      await expect
        .poll(async () => Number(await page.locator(".mc-journey").getAttribute("data-progress")))
        .toBeCloseTo(progress, 2);
    }
    const canvas = page.getByRole("button", { name: "Interactive Möbius sculpture" });
    await canvas.press("Enter");
    await expect(page.locator(".mc-sculpture")).toHaveAttribute("data-interaction", "pulse");
    await page.getByRole("link", { name: "Skip to the collective" }).click();
    await expect(page.locator("#collective")).toBeInViewport();
    expect(errors).toEqual([]);
  } finally {
    await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await session.detach();
  }
});

test("theme option text, swatch and row padding all select the palette", async ({ page, isMobile }) => {
  await page.goto("/app/", { waitUntil: "domcontentloaded" });
  for (const [id, x] of [
    ["arctic", 0.55],
    ["emerald", 0.1],
    ["nebula", 0.94],
  ]) {
    await page.getByRole("button", { name: /^Appearance:/ }).click();
    const box = await page.locator(`.mc-theme-options label[data-swatch="${id}"]`).boundingBox();
    if (isMobile) await page.touchscreen.tap(box.x + box.width * x, box.y + box.height * 0.55);
    else await page.mouse.click(box.x + box.width * x, box.y + box.height * 0.55);
    await expect(page.locator("[data-public-theme]")).toHaveAttribute("data-public-theme", id);
    await expect(page.locator(`input[value="${id}"]`)).toBeChecked();
    await page.keyboard.press("Escape");
  }
  await page.reload();
  await expect(page.locator("[data-public-theme]")).toHaveAttribute("data-public-theme", "nebula");
});

async function publicNav(page, name) {
  await expect(page.locator(".mc-header")).toBeVisible();
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: /^(Main|Mobile) navigation$/ })
    .filter({ visible: true })
    .getByRole("link", { name, exact: true })
    .click();
}

test("public transitions preserve history, query strings and responsive navigation", async ({ page }) => {
  await page.goto("/app/gallery?collection=all");
  await expect(page.locator(".mc-gallery-editorial")).toBeVisible();
  await publicNav(page, "Events");
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.locator("html")).not.toHaveAttribute("data-mc-transition");
  await publicNav(page, "Leaderboard");
  await expect(page).toHaveURL(/\/leaderboard$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/events$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/gallery\?collection=all$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.locator("html")).not.toHaveAttribute("data-mc-transition");
  await publicNav(page, "Arena");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("html")).not.toHaveAttribute("data-mc-transition");
});

test("rapid public navigation and failed snapshots cannot leave a stuck transition", async ({ page }) => {
  await page.goto("/app/gallery");
  await expect(page.locator(".mc-gallery-editorial")).toBeVisible();
  // Dispatch in one task to reproduce a second choice before snapshot callback.
  await page.evaluate(() => {
    document.querySelector('.mc-public a[href$="/events"]').click();
    document.querySelector('.mc-public a[href$="/leaderboard"]').click();
  });
  await expect(page).toHaveURL(/\/leaderboard$/);
  await expect(page.locator("html")).not.toHaveAttribute("data-mc-transition");
  await page.evaluate(() => {
    document.startViewTransition = () => {
      throw new Error("test snapshot failure");
    };
  });
  await publicNav(page, "Gallery");
  await expect(page.locator(".mc-gallery-editorial")).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-mc-transition");
});

test("gallery composition preserves order and accessible low-motion media", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/gallery");
  const figures = page.locator(".mc-gallery-grid figure");
  await expect(figures).toHaveCount(29);
  await expect(figures.nth(0)).toContainText("Start");
  await expect(figures.nth(1)).toContainText("Clue I");
  await expect(figures.nth(2)).toContainText("Chase");
  expect(
    await page
      .locator("video")
      .evaluateAll((videos) => videos.every((v) => v.controls && !v.autoplay && v.preload === "none")),
  ).toBe(true);
  expect(await figures.evaluateAll((items) => items.every((e) => getComputedStyle(e).opacity === "1"))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("leaderboard tabs retain weekly, lifetime, winner and event API shapes", async ({ page }) => {
  const fixtures = {
    "/api/leaderboard": [{ name: "Weekly fixture", xp: 0 }],
    "/api/leaderboard/alltime": [{ name: "Lifetime fixture", xp: 321 }],
    "/api/leaderboard/winners": [{ winner_name: "Winner fixture", winner_xp: 123 }],
    "/api/events": [{ id: 71, title: "Completed fixture", event_type: "competition", status: "completed" }],
    "/api/events/71/leaderboard": [{ student_name: "Event fixture", score: 42 }],
  };
  await page.route("**/api/**", (route) => {
    const data = fixtures[new URL(route.request().url()).pathname];
    return data ? route.fulfill({ json: data }) : route.fallback();
  });
  await page.goto("/app/leaderboard");
  await expect(page.getByText("Weekly fixture", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "All Time", exact: true }).click();
  await expect(page.getByText("Lifetime fixture", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hall of Fame", exact: true }).click();
  await expect(page.getByText("Winner fixture", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Events", exact: true }).click();
  await page.getByRole("combobox", { name: "Competition leaderboard" }).selectOption("71");
  await expect(page.getByText("Event fixture", { exact: true })).toBeVisible();
});

test("event filters and guest registration preserve the sign-in boundary", async ({ page }) => {
  const writes = [];
  await page.route("**/api/events", (route) =>
    route.fulfill({
      json: [
        {
          id: 91,
          title: "Open fixture event",
          event_type: "competition",
          status: "registering",
          max_participants: 100,
          registered_count: 2,
        },
        { id: 92, title: "Past fixture event", event_type: "workshop", status: "completed" },
      ],
    }),
  );
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/events/")) writes.push(request.url());
  });
  await page.goto("/app/events");
  await expect(page.getByRole("heading", { name: "Open fixture event", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Past", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Past fixture event", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open fixture event", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Open fixture event", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Register Now/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(writes).toEqual([]);
});

test("router visibly retains the outgoing page and animates the destination without snapshot API", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    document.startViewTransition = undefined;
  });
  await page.goto("/app/");
  await expect(page.locator('#mc-main[data-mc-route="/"]')).toBeVisible();
  await publicNav(page, "Events");
  await expect(page.locator(".mc-route-veil")).toHaveAttribute("data-phase", "exit");
  await expect(page.locator("#mc-main")).toHaveAttribute("data-mc-route", "/");
  await expect
    .poll(() => page.locator(".mc-route-veil").evaluate((e) => Number(getComputedStyle(e).opacity)))
    .toBeGreaterThan(0.15);
  await page.screenshot({ path: testInfo.outputPath("route-exit.png") });
  await expect(page.locator("#mc-main")).toHaveAttribute("data-mc-route", "/events");
  await expect.poll(() => page.locator("#mc-main").evaluate((e) => e.getAnimations().length)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath("route-enter.png") });
  await expect(page.locator("html")).not.toHaveAttribute("data-mc-transition");
  await publicNav(page, "Gallery");
  await expect(page.locator("#mc-main")).toHaveAttribute("data-mc-route", "/gallery");
  await expect(page.locator("html")).not.toHaveAttribute("data-mc-transition");
  await page.goBack();
  await expect(page.locator(".mc-route-veil")).toHaveAttribute("data-phase", "exit");
  await expect(page.locator("#mc-main")).toHaveAttribute("data-mc-route", "/events");
  await expect(page.locator("html")).not.toHaveAttribute("data-mc-transition");
  await page.goForward();
  await expect(page.locator("#mc-main")).toHaveAttribute("data-mc-route", "/gallery");
  await expect(page.locator("html")).not.toHaveAttribute("data-mc-transition");
});

test("route overlay follows each palette and reduced motion bypasses it", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app/events");
  for (const [index, name] of ["Obsidian", "Arctic", "Emerald Matrix", "Nebula"].entries()) {
    await page.getByRole("button", { name: /^Appearance:/ }).click();
    await page.getByRole("radio", { name: new RegExp(name) }).check();
    await page.keyboard.press("Escape");
    await publicNav(page, index % 2 ? "Events" : "Gallery");
    await expect(page.locator(".mc-route-veil")).toHaveAttribute("data-phase", "exit");
    expect(await page.locator(".mc-route-veil").evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    await expect(page.locator("html")).not.toHaveAttribute("data-mc-transition");
    await expect(page.getByRole("button", { name: `Appearance: ${name}` })).toBeVisible();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await publicNav(page, "Gallery");
  await expect(page.locator("#mc-main")).toHaveAttribute("data-mc-route", "/gallery");
  await expect(page.locator("html")).not.toHaveAttribute("data-mc-transition");
  expect(await page.locator("#mc-main").evaluate((e) => e.getAnimations().length)).toBe(0);
  expect(errors).toEqual([]);
});
