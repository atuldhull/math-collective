/**
 * The password floor must be ONE number.
 *
 * Regression guard for the bug members actually reported: register and
 * the recovery reset accepted 6 characters while POST
 * /api/user/change-password demanded 8. Anyone who signed up with a
 * 6-character password could never change it — the profile form let the
 * request through and the API's 400 came back in a shape the UI didn't
 * read, so it surfaced as a bare "Failed to change password".
 */

import { describe, it, expect } from "vitest";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT } from "../../backend/lib/passwordPolicy.js";
import { registerSchema, resetPasswordSchema } from "../../backend/validators/auth.js";
import { changePasswordSchema } from "../../backend/validators/user.js";

const atMin   = "a".repeat(MIN_PASSWORD_LENGTH);
const belowMin = "a".repeat(MIN_PASSWORD_LENGTH - 1);

describe("password floor is shared by every set-a-password route", () => {
  const cases = [
    ["register",        (pw) => registerSchema.safeParse({ email: "a@b.com", password: pw })],
    ["recovery reset",  (pw) => resetPasswordSchema.safeParse({ access_token: "t", new_password: pw })],
    ["in-session change", (pw) => changePasswordSchema.safeParse({ currentPassword: "whatever", newPassword: pw })],
  ];

  it.each(cases)("%s accepts exactly the minimum", (_name, run) => {
    expect(run(atMin).success).toBe(true);
  });

  it.each(cases)("%s rejects one character below the minimum", (_name, run) => {
    expect(run(belowMin).success).toBe(false);
  });
});

describe("the message members see", () => {
  it("names the actual number, so the rule is discoverable", () => {
    expect(PASSWORD_TOO_SHORT).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("is the message the schemas emit", () => {
    const r = registerSchema.safeParse({ email: "a@b.com", password: belowMin });
    expect(r.success).toBe(false);
    expect(r.error.issues.some((i) => i.message === PASSWORD_TOO_SHORT)).toBe(true);
  });
});
