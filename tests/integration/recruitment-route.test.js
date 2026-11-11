import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn() }));
vi.mock("../../backend/config/supabase.js", () => ({ default: { from: db.from } }));
const { default: recruitmentRoutes } = await import("../../backend/routes/recruitmentRoutes.js");
const app = express();
app.use(express.json());
app.use("/api/recruitment", recruitmentRoutes);

const base = {
  name: "Test Student", phone: "9876543210", usn: "24UG1BYAI038",
  branch: "CSE", section: "1",
  first_preference: "Event Design", second_preference: "Marketing & Social Media", rules_accepted: true,
};

const categories = [
  [1, "first-year", "student@example.com"],
  [2, "normal", "student@bmsit.in"],
  [2, "lateral", "student@example.com"],
  [3, "normal", "student@bmsit.in"],
  [3, "lateral", "student@example.com"],
];

beforeEach(() => {
  db.from.mockReset();
  db.insert.mockReset();
  db.from.mockReturnValue({ insert: db.insert });
  db.insert.mockResolvedValue({ error: null });
});

describe("POST /api/recruitment", () => {
  it.each(categories)("validates and writes %i %s", async (year, student_type, email) => {
    const response = await request(app).post("/api/recruitment").send({ ...base, year, student_type, email });
    expect(response.status).toBe(201);
    expect(db.from).toHaveBeenCalledWith("recruitment_registrations");
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({
      year, student_type, email, name: base.name, usn: base.usn,
      branch: "CSE", section: "1",
      first_preference: base.first_preference, second_preference: base.second_preference,
      rules_accepted: true,
    }));
    expect(JSON.stringify(response.body)).not.toContain(base.name);
  });

  it.each(categories)("rejects the wrong email type for %i %s before storage", async (year, student_type) => {
    const wrongEmail = student_type === "normal" ? "student@gmail.com" : "student@bmsit.in";
    const response = await request(app).post("/api/recruitment").send({
      ...base, year, student_type, email: wrongEmail,
    });
    expect(response.status).toBe(400);
    expect(response.body.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: "email" })]));
    expect(db.insert).not.toHaveBeenCalled();
  });

  it.each([
    ["missing name", { name: "" }, "name"],
    ["missing email", { email: "" }, "email"],
    ["missing branch", { branch: "" }, "branch"],
    ["missing section", { section: "" }, "section"],
    ["unlisted branch", { branch: "MECH" }, "branch"],
    ["unlisted section", { section: "15" }, "section"],
    ["invalid phone", { phone: "123" }, "phone"],
    ["invalid USN", { usn: "x" }, "usn"],
    ["unaccepted rules", { rules_accepted: false }, "rules_accepted"],
    ["duplicate preferences", { second_preference: "Event Design" }, "second_preference"],
    ["unknown preference", { first_preference: "invented" }, "first_preference"],
    ["wrong year/type pair", { year: 1, student_type: "normal" }, "student_type"],
  ])("rejects %s before storage", async (_name, change, field) => {
    const response = await request(app).post("/api/recruitment").send({
      ...base, year: 2, student_type: "normal", email: "student@bmsit.in", ...change,
    });
    expect(response.status).toBe(400);
    expect(response.body.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: field })]));
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("returns a private, retryable error when the database write fails", async () => {
    db.insert.mockResolvedValue({ error: { message: "private database detail" } });
    const response = await request(app).post("/api/recruitment").send({
      ...base, year: 2, student_type: "normal", email: "student@bmsit.in",
    });
    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain("private database detail");
    expect(JSON.stringify(response.body)).not.toContain(base.name);
  });
});
