/**
 * readRecoveryParams — what a password-reset link actually carries.
 *
 * The old LoginPage only looked for `#access_token=...&type=recovery`.
 * Every other shape a Supabase recovery link can take (OTP hash in the
 * query string; an expired link that carries only an error) fell
 * through and rendered a plain login form, so members reported that
 * clicking the reset link "did nothing".
 */

import { describe, it, expect } from "vitest";
import { readRecoveryParams } from "../../frontend/src/features/auth/pages/ResetPasswordPage.jsx";

describe("readRecoveryParams", () => {
  it("reads access_token from the URL fragment (implicit flow)", () => {
    const { token, linkError } = readRecoveryParams("#access_token=tok123&type=recovery", "");
    expect(token).toEqual({ access_token: "tok123" });
    expect(linkError).toBeNull();
  });

  it("reads token_hash from the query string (OTP-hash flow)", () => {
    const { token } = readRecoveryParams("", "?token_hash=hash456&type=recovery");
    expect(token).toEqual({ token_hash: "hash456" });
  });

  it("accepts the older `token` param name", () => {
    const { token } = readRecoveryParams("", "?token=old789&type=recovery");
    expect(token).toEqual({ token_hash: "old789" });
  });

  it("surfaces the reason an expired link failed instead of staying silent", () => {
    const { token, linkError } = readRecoveryParams(
      "#error=access_denied&error_description=Email+link+is+invalid+or+has+expired",
      "",
    );
    expect(token).toBeNull();
    expect(linkError).toBe("Email link is invalid or has expired");
  });

  it("returns no token and no error for an ordinary visit", () => {
    const { token, linkError } = readRecoveryParams("", "");
    expect(token).toBeNull();
    expect(linkError).toBeNull();
  });
});
