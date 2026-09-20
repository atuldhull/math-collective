/**
 * Role and suspension must not be trusted for the whole session life.
 *
 * Both were copied into the session at login and read from there
 * afterwards, so demoting an admin or suspending a student did not bite
 * until the 7-day session expired — a removed admin kept admin access
 * for up to a week. The guards now re-read both from the database every
 * couple of minutes and tear the session down when either changed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const state = { row: null, throws: false, reads: 0 };

beforeEach(() => {
  state.row    = { role: "admin", org_id: "org-A", is_active: true, xp: 0, title: "T" };
  state.throws = false;
  state.reads  = 0;
});

vi.mock("../../backend/config/supabase.js", () => {
  const chain = {
    from:   () => chain,
    select: () => chain,
    eq:     () => chain,
    // Must be a real promise: the presence ping does .then().catch().
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    maybeSingle: async () => {
      state.reads += 1;
      if (state.throws) throw new Error("db down");
      return { data: state.row, error: null };
    },
  };
  return { default: chain, createAuthClient: () => chain };
});

const { requireAuth, requireAdmin } = await import("../../backend/middleware/authMiddleware.js");

/* One express app whose session object persists between requests, so we
   can watch the cached claims age across calls the way a real one does. */
function buildApp(guard, sessionUser) {
  const app = express();
  const session = { user: sessionUser };
  app.use((req, _res, next) => {
    req.session = session;
    req.session.destroy = (cb) => { session.user = null; cb?.(); };
    next();
  });
  app.get("/probe", guard, (req, res) => res.json({ role: req.userRole }));
  return app;
}

const ADMIN = { id: "u-1", role: "admin", org_id: "org-A", is_active: true };

describe("requireAdmin", () => {
  it("lets a current admin through", async () => {
    const res = await request(buildApp(requireAdmin, { ...ADMIN })).get("/probe");
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
  });

  it("locks out an admin who has been demoted in the database", async () => {
    state.row = { ...state.row, role: "student" };
    const res = await request(buildApp(requireAdmin, { ...ADMIN })).get("/probe");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("ROLE_CHANGED");
  });

  it("locks out a user who has been suspended", async () => {
    state.row = { ...state.row, is_active: false };
    const res = await request(buildApp(requireAdmin, { ...ADMIN })).get("/probe");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/suspended/i);
  });
});

describe("requireAuth", () => {
  it("does not re-read the database on every request", async () => {
    const app = buildApp(requireAuth, { ...ADMIN });
    await request(app).get("/probe");
    const afterFirst = state.reads;
    await request(app).get("/probe");
    await request(app).get("/probe");
    expect(state.reads).toBe(afterFirst);
  });

  it("re-reads once the cached copy has aged past the window", async () => {
    const user = { ...ADMIN };
    const app = buildApp(requireAuth, user);
    await request(app).get("/probe");
    const afterFirst = state.reads;

    user.revalidatedAt = Date.now() - 10 * 60 * 1000;   // pretend time passed
    state.row = { ...state.row, role: "student" };
    const res = await request(app).get("/probe");

    expect(state.reads).toBeGreaterThan(afterFirst);
    expect(res.status).toBe(401);
  });

  it("keeps the cached claims when the database is unreachable", async () => {
    // A blip must not sign the whole site out.
    const user = { ...ADMIN, revalidatedAt: Date.now() - 10 * 60 * 1000 };
    state.throws = true;
    const res = await request(buildApp(requireAuth, user)).get("/probe");
    expect(res.status).toBe(200);
  });

  it("does not demote anyone when the row has no role set", async () => {
    // refreshSession defaults a missing role to "student"; accepting
    // that default would silently strip staff of their access.
    const user = { ...ADMIN, revalidatedAt: Date.now() - 10 * 60 * 1000 };
    state.row = { org_id: "org-A", is_active: true };
    const res = await request(buildApp(requireAuth, user)).get("/probe");
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
  });

  it("does not lock out a user who simply has no students row (super_admin)", async () => {
    const user = { ...ADMIN, role: "super_admin", revalidatedAt: Date.now() - 10 * 60 * 1000 };
    state.row = null;
    const res = await request(buildApp(requireAuth, user)).get("/probe");
    expect(res.status).toBe(200);
  });
});
