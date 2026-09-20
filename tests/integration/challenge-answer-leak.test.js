/**
 * Integration — the question endpoints must not ship the answer.
 *
 * GET /api/challenge/current, /next and /:id used to select
 * `correct_index, solution` and return them to anyone, without
 * requiring a login, BEFORE the student had answered. Opening the
 * Network tab won every arena challenge, so arena XP and the
 * leaderboards were not worth anything.
 *
 * Staff keep the fields: the admin and teacher screens edit and preview
 * challenges. Students get the answer from POST /api/arena/submit,
 * after an attempt has been recorded.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const state = { selected: null, row: null, rows: [] };

beforeEach(() => {
  state.selected = null;
  state.row = {
    id: "c-1",
    title: "Warm up",
    question: "2 + 2?",
    options: ["3", "4", "5", "6"],
    difficulty: "easy",
    points: 50,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    correct_index: 1,
    solution: "Because it is four.",
  };
  state.rows = [state.row];
});

vi.mock("../../backend/config/supabase.js", () => ({
  default: {}, createAuthClient: () => ({}),
}));

const {
  getCurrentChallenge, getNextChallenge, getChallengeById,
} = await import("../../backend/controllers/challengeController.js");

/* Records the column list the controller asked for, then answers with
   only those columns — the same thing PostgREST would do. */
function fakeDb() {
  const project = (row) => {
    if (!row) return null;
    const cols = state.selected.split(",").map((c) => c.trim());
    return Object.fromEntries(cols.filter((c) => c in row).map((c) => [c, row[c]]));
  };
  const chain = {
    from:  () => chain,
    select: (cols) => { state.selected = cols; return chain; },
    eq:    () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: project(state.row), error: null }),
    then: (resolve) => resolve({ data: state.rows.map(project), error: null }),
  };
  return chain;
}

function buildApp(role = null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = role ? { user: { id: "u-1", role, org_id: "org-A" } } : {};
    req.db = fakeDb();
    next();
  });
  app.get("/current", getCurrentChallenge);
  app.get("/next",    getNextChallenge);
  app.get("/:id",     getChallengeById);
  return app;
}

const bodyOf = (res) => JSON.stringify(res.body);
/* /current returns the row bare; /next wraps it. Accept either. */
const challengeOf = (res) => res.body.challenge ?? res.body;

describe("answers are withheld from the people being asked", () => {
  it.each(["/current", "/next", "/c-1"])(
    "GET %s does not leak correct_index or solution to a student",
    async (path) => {
      const res = await request(buildApp("student")).get(path);
      expect(res.status).toBe(200);
      expect(bodyOf(res)).not.toContain("correct_index");
      expect(bodyOf(res)).not.toContain("Because it is four.");
    },
  );

  it("still returns the question itself, so the arena works", async () => {
    const res = await request(buildApp("student")).get("/current");
    expect(challengeOf(res).question).toBe("2 + 2?");
    expect(challengeOf(res).options).toHaveLength(4);
  });

  it("does not even ASK the database for the answer columns", async () => {
    await request(buildApp("student")).get("/current");
    expect(state.selected).not.toContain("correct_index");
    expect(state.selected).not.toContain("solution");
  });

  it("withholds the answer from a caller with no session at all", async () => {
    const res = await request(buildApp(null)).get("/current");
    expect(bodyOf(res)).not.toContain("correct_index");
  });
});

describe("staff still get the answer", () => {
  it.each(["teacher", "admin", "super_admin"])("%s sees correct_index", async (role) => {
    const res = await request(buildApp(role)).get("/current");
    expect(challengeOf(res).correct_index).toBe(1);
    expect(challengeOf(res).solution).toBe("Because it is four.");
  });
});
