/**
 * The admin side of the recruitment intake.
 *
 * The public form could write registrations that nothing could read back.
 * These endpoints are that missing half, and they carry applicants' personal
 * details — so what is pinned here is: the rows come back, the counts are
 * right, the CSV is real CSV, and a table that does not exist yet reads as
 * "nothing yet" rather than a server error.
 *
 * requireAdmin is mounted in adminRoutes.js, which these tests bypass by
 * mounting the controller directly; the guard itself is covered by the
 * auth-guard tests.
 */
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), order: vi.fn() }));
vi.mock("../../backend/config/supabase.js", () => ({ default: { from: db.from } }));
vi.mock("../../backend/config/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { listRecruitment, exportRecruitment } = await import(
  "../../backend/controllers/admin/recruitment.js"
);

const app = express();
app.get("/api/admin/recruitment", listRecruitment);
app.get("/api/admin/recruitment/export", exportRecruitment);

const rows = [
  {
    id: "1", year: 1, student_type: "first-year", name: "Ada Lovelace",
    phone: "9876543210", email: "ada@example.com", usn: "24UG1BYAI001",
    branch: "CSE", section: "A", first_preference: "Event Design",
    second_preference: "PR & Sponsorship", submitted_at: "2026-11-11T10:00:00Z",
  },
  {
    id: "2", year: 2, student_type: "normal", name: "Alan Turing",
    phone: "9876543211", email: "alan@bmsit.in", usn: "24UG1BYAI002",
    branch: "ISE", section: "B", first_preference: "Event Design",
    second_preference: "Technology & Systems", submitted_at: "2026-11-10T10:00:00Z",
  },
  {
    id: "3", year: 2, student_type: "lateral", name: "Grace Hopper",
    phone: "9876543212", email: "grace@example.com", usn: "24UG1BYAI003",
    branch: "CSE", section: "A", first_preference: "Quantitative Strategy",
    second_preference: "Event Design", submitted_at: "2026-11-09T10:00:00Z",
  },
];

/** The controller chains .select().order().order(), so the second order()
 *  is what resolves. */
function respondWith(result) {
  db.from.mockReturnValue({ select: db.select });
  db.select.mockReturnValue({ order: db.order });
  db.order.mockReturnValueOnce({ order: () => Promise.resolve(result) });
}

beforeEach(() => {
  db.from.mockReset();
  db.select.mockReset();
  db.order.mockReset();
});

describe("GET /api/admin/recruitment", () => {
  it("returns every registration", async () => {
    respondWith({ data: rows, error: null });
    const res = await request(app).get("/api/admin/recruitment");

    expect(res.status).toBe(200);
    expect(db.from).toHaveBeenCalledWith("recruitment_registrations");
    expect(res.body.registrations).toHaveLength(3);
    expect(res.body.tableReady).toBe(true);
  });

  it("counts the totals the page shows", async () => {
    respondWith({ data: rows, error: null });
    const res = await request(app).get("/api/admin/recruitment");

    expect(res.body.summary.total).toBe(3);
    expect(res.body.summary.byYear).toEqual({ "Year 1": 1, "Year 2": 2 });
    expect(res.body.summary.byBranch).toEqual({ CSE: 2, ISE: 1 });
    expect(res.body.summary.byFirstPreference["Event Design"]).toBe(2);
    expect(res.body.summary.byFirstPreference["Quantitative Strategy"]).toBe(1);
    expect(res.body.summary.byStudentType).toEqual({ "first-year": 1, normal: 1, lateral: 1 });
  });

  it("reads a table that does not exist yet as nothing-yet, not an error", async () => {
    // Expected until migration 45 has been run in Supabase.
    respondWith({ data: null, error: { code: "PGRST205", message: "Could not find the table" } });
    const res = await request(app).get("/api/admin/recruitment");

    expect(res.status).toBe(200);
    expect(res.body.tableReady).toBe(false);
    expect(res.body.registrations).toEqual([]);
    expect(res.body.summary.total).toBe(0);
    expect(res.body.summary.byBranch).toEqual({});
  });

  it("reports a real database failure as a failure", async () => {
    respondWith({ data: null, error: { code: "57014", message: "statement timeout" } });
    const res = await request(app).get("/api/admin/recruitment");

    expect(res.status).toBe(500);
    expect(res.body.registrations).toBeUndefined();
  });

  it("never leaks database diagnostics to the client", async () => {
    respondWith({ data: null, error: { code: "57014", message: "statement timeout on recruitment_registrations" } });
    const res = await request(app).get("/api/admin/recruitment");

    expect(JSON.stringify(res.body)).not.toMatch(/statement timeout/i);
  });
});

describe("GET /api/admin/recruitment/export", () => {
  it("sends a CSV attachment with a header row per registration", async () => {
    respondWith({ data: rows, error: null });
    const res = await request(app).get("/api/admin/recruitment/export");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="recruitment_\d{4}-\d{2}-\d{2}\.csv"/);

    const lines = res.text.replace(/^﻿/, "").trim().split("\n");
    expect(lines).toHaveLength(4); // header + 3 rows
    expect(lines[0]).toContain("1st preference");
    expect(lines[0]).toContain("2nd preference");
    expect(lines[1]).toContain("Ada Lovelace");
    expect(lines[1]).toContain("24UG1BYAI001");
  });

  it("quotes a field containing a comma so columns do not shift", async () => {
    respondWith({
      data: [{ ...rows[0], branch: "CSE, AI & ML" }],
      error: null,
    });
    const res = await request(app).get("/api/admin/recruitment/export");

    expect(res.text).toContain('"CSE, AI & ML"');
  });

  it("exports only rows matching the department and other active filters", async () => {
    respondWith({ data: rows, error: null });
    const res = await request(app)
      .get("/api/admin/recruitment/export")
      .query({ branch: "CSE", year: "2", preference: "Quantitative Strategy", search: "grace" });

    expect(res.status).toBe(200);
    const lines = res.text.replace(/^﻿/, "").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Grace Hopper");
    expect(res.text).not.toContain("Ada Lovelace");
    expect(res.text).not.toContain("Alan Turing");
  });

  it("still returns a usable CSV before the table exists", async () => {
    respondWith({ data: null, error: { code: "PGRST205", message: "Could not find the table" } });
    const res = await request(app).get("/api/admin/recruitment/export");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
  });
});
