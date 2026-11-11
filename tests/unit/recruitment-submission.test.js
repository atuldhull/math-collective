import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), from: vi.fn() }));
vi.mock("../../backend/config/supabase.js", () => ({ default: { from: mocks.from } }));
vi.mock("../../shared/recruitmentConfig.js", () => ({ recruitmentReady: true }));

const { submitRecruitment } = await import("../../backend/controllers/recruitmentController.js");

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

const body = {
  year: 3, student_type: "normal", name: "Private Student", phone: "9876543210",
  email: "STUDENT@BMSIT.IN", usn: "24ug1byai038", branch: "Branch", section: "A",
  first_preference: "Technology & Systems", second_preference: "Marketing & Social Media", rules_accepted: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockResolvedValue({ error: null });
});

describe("anonymous recruitment submission", () => {
  it("writes a structured private row and responds without personal data", async () => {
    const res = response();
    await submitRecruitment({ body }, res);
    expect(mocks.from).toHaveBeenCalledWith("recruitment_registrations");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      year: 3, student_type: "normal", email: "student@bmsit.in", usn: "24UG1BYAI038",
      first_preference: "Technology & Systems", second_preference: "Marketing & Social Media", rules_accepted: true,
    }));
    expect(res.statusCode).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain(body.name);
    expect(JSON.stringify(res.body)).not.toContain(body.email);
  });

  it("hides database diagnostics on failed writes", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "private database detail" } });
    const res = response();
    await submitRecruitment({ body }, res);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain("private database detail");
  });
});
