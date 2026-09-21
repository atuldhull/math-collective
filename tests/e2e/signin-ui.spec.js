/* global document */
/**
 * The sign-in page offers the college-email code flow by default, with
 * the password form still reachable for anyone who set one.
 */
import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 390, height: 844 } });
test("login page defaults to the code flow and can switch", async ({ page }) => {
  await page.goto("/app/login");
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel(/college email/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /email me a code/i })).toBeVisible();
  await page.getByRole("button", { name: /password instead/i }).click();
  await expect(page.getByLabel(/^password$/i)).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
