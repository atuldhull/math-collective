/**
 * Integration — privileged admin actions must check the TARGET.
 *
 * `requireAdmin` only ever proved the caller was staff. reset-password
 * and delete-user then passed a raw :userId straight to Supabase's
 * admin API, so any admin (or a stolen admin session) could reset the
 * super-admin's password and log in as them, or delete an auth account
 * belonging to another organisation.
 *
 * The guard is: resolve the target through the ORG-SCOPED req.db, and
 * refuse unless the caller strictly outranks them. Both failures answer
 * 404 so an admin cannot probe for the super-admin's user id.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const state = {
  targetRow:       null,   // what req.db returns for the target lookup
  adminUpdateErr:  null,
  adminDeleteErr:  null,
  authUpdateCalls: [],
  authDeleteCalls: [],
  studentDeletes:  [],
  roleUpdates:     [],
};

beforeEach(() => {
  state.targetRow       = null;
  state.adminUpdateErr  = null;
  state.adminDeleteErr  = null;
  state.authUpdateCalls = [];
  state.authDeleteCalls = [];
  state.studentDeletes  = [];
  state.roleUpdates     = [];
});

vi.mock("../../backend/config/supabase.js", () => {
  const fake = {
    auth: {
      admin: {
        updateUserById: async (id, payload) => {
          state.authUpdateCalls.push({ id, payload });
          return { error: state.adminUpdateErr };
        },
        deleteUser: async (id) => {
          state.authDeleteCalls.push(id);
          return { error: state.adminDeleteErr };
        },
      },
    },
  };
  return { default: fake, createAuthClient: () => fake };
});

vi.mock("../../backend/lib/audit.js", () => ({
  writeAudit:  vi.fn(),
  AuditAction: new Proxy({}, { get: (_t, k) => String(k) }),
}));

const { resetUserPassword, updateUserRole, deleteUser } =
  await import("../../backend/controllers/admin/users.js");

/* A minimal stand-in for the org-scoped req.db. The target lookup only
   resolves when state.targetRow is set, which is how we model "that row
   is in another organisation" — the scoped client simply cannot see it. */
function fakeDb() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.targetRow, error: null }),
        }),
      }),
      update: (payload) => ({
        eq: async (_col, id) => {
          state.roleUpdates.push({ id, payload });
          return { data: null, error: null };
        },
      }),
      delete: () => ({
        eq: async (_col, id) => {
          state.studentDeletes.push(id);
          return { data: null, error: null };
        },
      }),
    }),
  };
}

function buildApp(actorRole = "admin") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { user: { id: "actor-1", role: actorRole, org_id: "org-A" } };
    req.db = fakeDb();
    next();
  });
  app.post("/users/:userId/reset-password", resetUserPassword);
  app.patch("/users/:userId/role",          updateUserRole);
  app.delete("/users/:userId",              deleteUser);
  return app;
}

const SUPER = { user_id: "victim", email: "boss@x.edu", name: "Boss", role: "super_admin", org_id: "org-A" };
const PEER  = { user_id: "victim", email: "peer@x.edu", name: "Peer", role: "admin",       org_id: "org-A" };
const PUPIL = { user_id: "victim", email: "kid@x.edu",  name: "Kid",  role: "student",     org_id: "org-A" };

describe("POST /users/:userId/reset-password", () => {
  it("refuses an admin resetting the super-admin, and touches nothing", async () => {
    state.targetRow = SUPER;
    const res = await request(buildApp("admin"))
      .post("/users/victim/reset-password").send({ newPassword: "newsecret123" });
    expect(res.status).toBe(404);
    expect(state.authUpdateCalls).toEqual([]);
  });

  it("refuses an admin resetting a peer admin", async () => {
    state.targetRow = PEER;
    const res = await request(buildApp("admin"))
      .post("/users/victim/reset-password").send({ newPassword: "newsecret123" });
    expect(res.status).toBe(404);
    expect(state.authUpdateCalls).toEqual([]);
  });

  it("refuses when the target is in another org (scoped lookup finds nothing)", async () => {
    state.targetRow = null;
    const res = await request(buildApp("admin"))
      .post("/users/outsider/reset-password").send({ newPassword: "newsecret123" });
    expect(res.status).toBe(404);
    expect(state.authUpdateCalls).toEqual([]);
  });

  it("hides the difference between 'not allowed' and 'no such user'", async () => {
    state.targetRow = SUPER;
    const denied = await request(buildApp("admin"))
      .post("/users/victim/reset-password").send({ newPassword: "newsecret123" });
    state.targetRow = null;
    const missing = await request(buildApp("admin"))
      .post("/users/ghost/reset-password").send({ newPassword: "newsecret123" });
    expect(denied.status).toBe(missing.status);
    expect(denied.body).toEqual(missing.body);
  });

  it("allows an admin resetting a student", async () => {
    state.targetRow = PUPIL;
    const res = await request(buildApp("admin"))
      .post("/users/victim/reset-password").send({ newPassword: "newsecret123" });
    expect(res.status).toBe(200);
    expect(state.authUpdateCalls).toHaveLength(1);
  });

  it("lets the super-admin reset an admin", async () => {
    state.targetRow = PEER;
    const res = await request(buildApp("super_admin"))
      .post("/users/victim/reset-password").send({ newPassword: "newsecret123" });
    expect(res.status).toBe(200);
  });

  it("still enforces the shared password floor, before any lookup", async () => {
    state.targetRow = PUPIL;
    const res = await request(buildApp("admin"))
      .post("/users/victim/reset-password").send({ newPassword: "short" });
    expect(res.status).toBe(400);
    expect(state.authUpdateCalls).toEqual([]);
  });
});

describe("DELETE /users/:userId", () => {
  it("refuses to delete the super-admin and never reaches the Auth API", async () => {
    state.targetRow = SUPER;
    const res = await request(buildApp("admin")).delete("/users/victim");
    expect(res.status).toBe(404);
    expect(state.authDeleteCalls).toEqual([]);
    expect(state.studentDeletes).toEqual([]);
  });

  it("refuses a cross-org delete, which used to orphan the auth account", async () => {
    state.targetRow = null;
    const res = await request(buildApp("admin")).delete("/users/outsider");
    expect(res.status).toBe(404);
    expect(state.authDeleteCalls).toEqual([]);
  });

  it("deletes a student in the caller's own org", async () => {
    state.targetRow = PUPIL;
    const res = await request(buildApp("admin")).delete("/users/victim");
    expect(res.status).toBe(200);
    expect(state.authDeleteCalls).toEqual(["victim"]);
  });
});

describe("PATCH /users/:userId/role", () => {
  it("refuses to demote a peer admin", async () => {
    state.targetRow = PEER;
    const res = await request(buildApp("admin"))
      .patch("/users/victim/role").send({ role: "student" });
    expect(res.status).toBe(404);
    expect(state.roleUpdates).toEqual([]);
  });

  it("refuses to grant a rank the caller does not outrank", async () => {
    state.targetRow = PUPIL;
    const res = await request(buildApp("admin"))
      .patch("/users/victim/role").send({ role: "admin" });
    expect(res.status).toBe(403);
    expect(state.roleUpdates).toEqual([]);
  });

  it("promotes a student to teacher", async () => {
    state.targetRow = PUPIL;
    const res = await request(buildApp("admin"))
      .patch("/users/victim/role").send({ role: "teacher" });
    expect(res.status).toBe(200);
    expect(state.roleUpdates).toHaveLength(1);
  });
});
