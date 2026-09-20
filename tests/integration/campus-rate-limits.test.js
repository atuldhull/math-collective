/**
 * Rate limits must survive a campus NAT.
 *
 * A college sends every student's traffic out through one or a few
 * public IPs, so an IP-keyed limit hands the WHOLE COLLEGE one quota.
 * Registration was 5 per hour: five students could sign up per hour
 * from campus Wi-Fi, which would have made an intake of 800 impossible.
 *
 * These tests fix the keying, not the numbers — the ceilings are meant
 * to be tuned per campus through the environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

const ORIGINAL_ENV = { ...process.env };

/* The limiters read env at module-evaluation time, so each test gets a
   fresh module registry. */
async function freshLimiters() {
  vi.resetModules();
  return import("../../backend/middleware/rateLimiter.js");
}

beforeEach(() => {
  delete process.env.TRUSTED_IPS;
  delete process.env.RATE_LIMIT_REGISTER_PER_IP_PER_HOUR;
  delete process.env.RATE_LIMIT_GENERAL_PER_MIN;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/** An app where every request can claim its own user id / email. */
function buildApp(limiter, { path = "/probe", method = "post" } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const uid = req.get("x-test-user");
    req.session = uid ? { user: { id: uid } } : {};
    next();
  });
  app.use(limiter);
  app[method](path, (_req, res) => res.json({ ok: true }));
  return app;
}

describe("registration is not capped for the whole campus", () => {
  it("gives each email its own budget instead of sharing one", async () => {
    const { registerLimiter } = await freshLimiters();
    const app = buildApp(registerLimiter);

    // One student burns their five attempts.
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/probe").send({ email: "first@bmsit.in" });
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post("/probe").send({ email: "first@bmsit.in" });
    expect(blocked.status).toBe(429);

    // The student sitting next to them, on the same Wi-Fi, is unaffected.
    const neighbour = await request(app).post("/probe").send({ email: "second@bmsit.in" });
    expect(neighbour.status).toBe(200);
  });

  it("still keeps an IP-wide ceiling against churned addresses", async () => {
    process.env.RATE_LIMIT_REGISTER_PER_IP_PER_HOUR = "3";
    const { registerIpLimiter } = await freshLimiters();
    const app = buildApp(registerIpLimiter);

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post("/probe").send({ email: `throwaway${i}@x.com` });
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post("/probe").send({ email: "throwaway9@x.com" });
    expect(blocked.status).toBe(429);
  });

  it("exempts an address listed in TRUSTED_IPS, for intake day", async () => {
    process.env.RATE_LIMIT_REGISTER_PER_IP_PER_HOUR = "2";
    process.env.TRUSTED_IPS = "::ffff:127.0.0.1,127.0.0.1";
    const { registerIpLimiter } = await freshLimiters();
    const app = buildApp(registerIpLimiter);

    for (let i = 0; i < 6; i++) {
      const res = await request(app).post("/probe").send({ email: `student${i}@bmsit.in` });
      expect(res.status).toBe(200);
    }
  });
});

describe("general API limit", () => {
  it("gives each signed-in student their own bucket", async () => {
    process.env.RATE_LIMIT_GENERAL_PER_MIN = "3";
    const { generalLimiter } = await freshLimiters();
    const app = buildApp(generalLimiter, { path: "/api/thing", method: "get" });

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/api/thing").set("x-test-user", "student-A");
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).get("/api/thing").set("x-test-user", "student-A");
    expect(blocked.status).toBe(429);

    // A classmate on the same NAT still gets their full allowance.
    const classmate = await request(app).get("/api/thing").set("x-test-user", "student-B");
    expect(classmate.status).toBe(200);
  });

  it("leaves non-API paths alone", async () => {
    process.env.RATE_LIMIT_GENERAL_PER_MIN = "1";
    const { generalLimiter } = await freshLimiters();
    const app = buildApp(generalLimiter, { path: "/about", method: "get" });

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/about");
      expect(res.status).toBe(200);
    }
  });
});

describe("contact form", () => {
  it("counts per person, not per college", async () => {
    const { contactLimiter } = await freshLimiters();
    const app = buildApp(contactLimiter);

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/probe").set("x-test-user", "student-A");
      expect(res.status).toBe(200);
    }
    expect((await request(app).post("/probe").set("x-test-user", "student-A")).status).toBe(429);
    expect((await request(app).post("/probe").set("x-test-user", "student-B")).status).toBe(200);
  });
});
