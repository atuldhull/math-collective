import { describe, expect, it } from "vitest";
import { recruitmentSchema } from "../../backend/validators/recruitment.js";
import { recruitmentConfig, recruitmentErrors } from "../../shared/recruitmentConfig.js";

const valid = {
  year: 2, student_type: "normal", name: "A Student", phone: "9876543210",
  email: "student@bmsit.in", usn: "24UG1BYAI038", branch: recruitmentConfig.branches[0] || "Test branch",
  section: recruitmentConfig.sections[0] || "Test section", first_preference: "Technology & Systems",
  second_preference: "Event Design", rules_accepted: true,
};

describe("recruitment intake validation", () => {
  it("uses the five canonical recruitment domain names", () => {
    expect(recruitmentConfig.options.map((option) => option.id)).toEqual([
      "Event Design",
      "Marketing & Social Media",
      "PR & Sponsorship",
      "Technology & Systems",
      "Quantitative Strategy",
    ]);
  });

  it("keeps the four approved recruitment rules verbatim", () => {
    expect(recruitmentConfig.rules).toEqual([
      "Please enter all details carefully and accurately.",
      "Providing incorrect information or misusing the registration may result in strict action.",
      "Lateral entry is for diploma students.",
      "The interview will be scheduled according to your IA exam schedule.",
    ]);
  });

  it("accepts all five year/type combinations with the appropriate email", () => {
    for (const [year, student_type, email] of [
      [1, "first-year", "student@example.com"],
      [2, "normal", "student@bmsit.in"],
      [2, "lateral", "student@example.com"],
      [3, "normal", "student@bmsit.in"],
      [3, "lateral", "student@example.com"],
    ]) {
      expect(recruitmentSchema.safeParse({ ...valid, year, student_type, email }).success).toBe(true);
    }
  });

  it("rejects category/email mismatches and duplicate or unknown choices", () => {
    expect(recruitmentErrors({ ...valid, year: 1 }).student_type).toBeTruthy();
    expect(recruitmentErrors({ ...valid, email: "student@gmail.com" }).email).toContain("@bmsit.in");
    expect(recruitmentErrors({ ...valid, student_type: "lateral" }).email).toContain("personal");
    expect(recruitmentSchema.safeParse({ ...valid, second_preference: "Technology & Systems" }).success).toBe(false);
    expect(recruitmentSchema.safeParse({ ...valid, first_preference: "invented" }).success).toBe(false);
    expect(recruitmentSchema.safeParse({ ...valid, first_preference: "technical" }).success).toBe(false);
  });

  it("requires consent and rejects extra fields", () => {
    expect(recruitmentSchema.safeParse({ ...valid, rules_accepted: false }).success).toBe(false);
    expect(recruitmentSchema.safeParse({ ...valid, admin: true }).success).toBe(false);
  });
});
