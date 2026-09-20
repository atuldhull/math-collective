/**
 * The recovery link has to land on a URL React Router can actually match.
 *
 * Regression guard: reset emails used to point at `<api host>/login`.
 * The SPA is mounted at /app/ with basename "/app", so /login fell
 * through to the SPA's 404 page and the recovery token in the fragment
 * was never read — members reported the reset link doing nothing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appOrigin, recoveryRedirectUrl, RECOVERY_PATH, SPA_MOUNT } from "../../backend/lib/appUrl.js";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.FRONTEND_URL;
  delete process.env.PUBLIC_URL;
});
afterEach(() => {
  process.env.FRONTEND_URL = ORIGINAL.FRONTEND_URL;
  process.env.PUBLIC_URL   = ORIGINAL.PUBLIC_URL;
});

describe("recoveryRedirectUrl", () => {
  it("lands under the SPA mount, not at the server root", () => {
    expect(RECOVERY_PATH.startsWith(`${SPA_MOUNT}/`)).toBe(true);
  });

  it("prefers FRONTEND_URL over the request host", () => {
    process.env.FRONTEND_URL = "https://mathcollective.example";
    const req = { protocol: "http", get: () => "api-internal.onrender.com" };
    expect(recoveryRedirectUrl(req)).toBe("https://mathcollective.example/app/reset-password");
  });

  it("tolerates a trailing slash on FRONTEND_URL", () => {
    process.env.FRONTEND_URL = "https://mathcollective.example/";
    expect(recoveryRedirectUrl(null)).toBe("https://mathcollective.example/app/reset-password");
  });

  it("falls back to the request origin in local dev", () => {
    const req = { protocol: "http", get: () => "localhost:5000" };
    expect(recoveryRedirectUrl(req)).toBe("http://localhost:5000/app/reset-password");
  });

  it("never points at /login — that route is guest-only", () => {
    process.env.FRONTEND_URL = "https://mathcollective.example";
    expect(appOrigin(null)).toBe("https://mathcollective.example");
    expect(recoveryRedirectUrl(null)).not.toMatch(/\/login$/);
  });
});
