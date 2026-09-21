/**
 * Integration — college-email sign-in by emailed code.
 *
 * This is the flow that rescues the Google Form import. Adding a row to
 * `students` does not create a Supabase Auth account, so a CSV-imported
 * member had no login at all: they could only link up by registering
 * with the byte-identical email, and then still had to receive a
 * verification message. Proving control of the college mailbox lets us
 * CLAIM their existing row instead, XP and history intact.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";

const ORIGINAL_ENV = { ...process.env };

const state = {
  otpSendError:   null,
  verifyResult:   { data: { user: null }, error: { message: "bad code" } },
  studentById:    null,
  studentByEmail: null,   // an unclaimed, imported row
  org:            null,
  defaultOrg:     { id: "org-A" },
  claimUpdates:   [],
  inserted:       [],
  sentTo:         [],
};

beforeEach(() => {
  process.env.ALLOWED_EMAIL_DOMAINS = "bmsit.in";
  state.otpSendError   = null;
  state.verifyResult   = { data: { user: null }, error: { message: "bad code" } };
  state.studentById    = null;
  state.studentByEmail = null;
  state.org            = null;
  state.claimUpdates   = [];
  state.inserted       = [];
  state.sentTo         = [];
});

afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

vi.mock("../../backend/lib/audit.js", () => ({
  writeAudit:  vi.fn(),
  AuditAction: new Proxy({}, { get: (_t, k) => String(k) }),
}));

vi.mock("../../backend/config/supabase.js", () => {
  /* Query router: which chain is running is identified by the filters
     applied, mirroring how the real queries differ. */
  function table(name) {
    const filters = {};
    const chain = {
      select: () => chain,
      eq: (col, val) => { filters[col] = val; return chain; },
      is: (col, val) => { filters[col] = val === null ? "IS_NULL" : val; return chain; },
      order: () => chain,
      limit: () => chain,
      update: (payload) => ({
        eq: (col, val) => ({
          is: () => {
            state.claimUpdates.push({ table: name, payload, [col]: val });
            return Promise.resolve({ error: null });
          },
          then: (r) => {
            if ("last_seen_at" in payload) return Promise.resolve({ error: null }).then(r);
            state.claimUpdates.push({ table: name, payload, [col]: val });
            return Promise.resolve({ error: null }).then(r);
          },
          catch: () => {},
        }),
      }),
      upsert: (row) => { state.inserted.push(row); return Promise.resolve({ error: null }); },
      maybeSingle: async () => {
        if (name === "organisations") {
          return { data: filters.id ? state.org : state.defaultOrg, error: null };
        }
        if (filters.user_id === "IS_NULL") return { data: state.studentByEmail, error: null };
        if (filters.user_id)               return { data: state.studentById,    error: null };
        return { data: null, error: null };
      },
    };
    return chain;
  }

  const fake = {
    from: table,
    auth: {
      signInWithOtp: async ({ email }) => {
        state.sentTo.push(email);
        return { error: state.otpSendError };
      },
      verifyOtp: async () => state.verifyResult,
    },
  };
  return { default: fake, createAuthClient: () => fake };
});

const authController = (await import("../../backend/controllers/authController.js")).default;
const { validateBody } = await import("../../backend/validators/common.js");
const { signInCodeRequestSchema, signInCodeVerifySchema } =
  await import("../../backend/validators/auth.js");

/* Mount the same middleware chain the real routes use — minus the rate
   limiters, which are process-wide and would bleed between tests. A
   harness that skips validateBody would let a malformed body reach the
   controller and quietly test a path production never takes. */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test-secret", resave: false, saveUninitialized: true }));
  app.post("/request", validateBody(signInCodeRequestSchema), authController.requestSignInCode);
  app.post("/verify",  validateBody(signInCodeVerifySchema),  authController.verifySignInCode);
  return app;
}

const AUTH_USER = { id: "auth-1", email: "24ug1byai190@bmsit.in", user_metadata: {} };

describe("POST /request — asking for a code", () => {
  it("refuses a personal address without sending anything", async () => {
    const res = await request(buildApp()).post("/request").send({ email: "someone@gmail.com" });
    expect(res.status).toBe(403);
    expect(state.sentTo).toEqual([]);
  });

  it("sends to a college address", async () => {
    const res = await request(buildApp()).post("/request").send({ email: "24ug1byai190@bmsit.in" });
    expect(res.status).toBe(200);
    expect(state.sentTo).toEqual(["24ug1byai190@bmsit.in"]);
  });

  it("does not reveal whether the address is on file", async () => {
    const known = await request(buildApp()).post("/request").send({ email: "a@bmsit.in" });
    state.otpSendError = { message: "User not found" };
    const unknown = await request(buildApp()).post("/request").send({ email: "b@bmsit.in" });
    expect(known.status).toBe(unknown.status);
    expect(known.body).toEqual(unknown.body);
  });
});

describe("POST /verify — the code itself", () => {
  it("rejects a wrong code", async () => {
    const res = await request(buildApp()).post("/verify")
      .send({ email: "a@bmsit.in", token: "000000" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/wrong or has expired/i);
  });

  it("refuses a personal address even with a valid-looking code", async () => {
    state.verifyResult = { data: { user: AUTH_USER }, error: null };
    const res = await request(buildApp()).post("/verify")
      .send({ email: "someone@gmail.com", token: "123456" });
    expect(res.status).toBe(403);
  });

  it("rejects a non-numeric code before reaching Supabase", async () => {
    const res = await request(buildApp()).post("/verify")
      .send({ email: "a@bmsit.in", token: "abcdef" });
    expect(res.status).toBe(400);
  });
});

describe("claiming an imported CSV row", () => {
  beforeEach(() => {
    state.verifyResult = { data: { user: AUTH_USER }, error: null };
    state.org = { id: "org-A", name: "BMSIT", slug: "bmsit", status: "active", plan_name: "free" };
  });

  it("links the imported row and keeps its XP, role and title", async () => {
    state.studentById    = null;                       // no auth account yet
    state.studentByEmail = {                           // ...but a CSV row exists
      name: "Madhooja Kar", email: "24ug1byai190@bmsit.in", user_id: null,
      role: "teacher", xp: 4200, title: "Vector Sage", org_id: "org-A", is_active: true,
    };

    const res = await request(buildApp()).post("/verify")
      .send({ email: "24ug1byai190@bmsit.in", token: "123456" });

    expect(res.status).toBe(200);
    expect(res.body.claimed).toBe(true);
    expect(res.body.user.xp).toBe(4200);
    expect(res.body.user.role).toBe("teacher");
    expect(res.body.user.name).toBe("Madhooja Kar");
    // The row was linked rather than duplicated.
    expect(state.claimUpdates.some((u) => u.payload.user_id === "auth-1")).toBe(true);
    expect(state.inserted).toEqual([]);
  });

  it("sends a teacher to the teacher dashboard, not the student one", async () => {
    state.studentByEmail = {
      name: "T", email: "24ug1byai190@bmsit.in", user_id: null,
      role: "teacher", xp: 0, title: "T", org_id: "org-A", is_active: true,
    };
    const res = await request(buildApp()).post("/verify")
      .send({ email: "24ug1byai190@bmsit.in", token: "123456" });
    expect(res.body.redirectTo).toBe("/teacher");
  });

  it("does not claim a row that already belongs to someone", async () => {
    // studentByEmail is only ever returned for the `user_id IS NULL`
    // query, so an owned row is invisible to the claim path.
    state.studentById    = {
      name: "Owner", email: "24ug1byai190@bmsit.in", user_id: "auth-1",
      role: "student", xp: 10, title: "Axiom Scout", org_id: "org-A", is_active: true,
    };
    state.studentByEmail = null;

    const res = await request(buildApp()).post("/verify")
      .send({ email: "24ug1byai190@bmsit.in", token: "123456" });
    expect(res.status).toBe(200);
    expect(res.body.claimed).toBe(false);
    expect(state.claimUpdates.filter((u) => "user_id" in u.payload)).toEqual([]);
  });

  it("creates a fresh row for a genuinely new member", async () => {
    state.studentById = null;
    state.studentByEmail = null;
    const res = await request(buildApp()).post("/verify")
      .send({ email: "24ug1byai190@bmsit.in", token: "123456" });
    expect(res.status).toBe(200);
    expect(res.body.claimed).toBe(false);
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0].org_id).toBe("org-A");
  });

  it("refuses a suspended member", async () => {
    state.studentById = {
      name: "S", email: "24ug1byai190@bmsit.in", user_id: "auth-1",
      role: "student", xp: 0, title: "T", org_id: "org-A", is_active: false,
    };
    const res = await request(buildApp()).post("/verify")
      .send({ email: "24ug1byai190@bmsit.in", token: "123456" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/suspended/i);
  });

  it("establishes a real session, so the next request is authenticated", async () => {
    state.studentByEmail = {
      name: "N", email: "24ug1byai190@bmsit.in", user_id: null,
      role: "student", xp: 5, title: "Axiom Scout", org_id: "org-A", is_active: true,
    };
    const agent = request.agent(buildApp());
    const res = await agent.post("/verify").send({ email: "24ug1byai190@bmsit.in", token: "123456" });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeTruthy();
    expect(res.body.user.org_id).toBe("org-A");
  });
});
