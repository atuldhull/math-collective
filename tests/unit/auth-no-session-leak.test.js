/**
 * The shared Supabase client must never be left holding a member's session.
 *
 * supabase-js stores the session from signInWithPassword / signUp / verifyOtp
 * ON the client instance that made the call. Run one of those against the
 * process-wide service-role singleton and every query afterwards goes out
 * carrying that member's JWT as role `authenticated` instead of service_role.
 *
 * The damage is invisible until it isn't: `authenticated` has grants on most
 * tables, so almost everything keeps working. It fails only where that role
 * was deliberately revoked — recruitment_registrations returned 42501 — or
 * where RLS is enabled, which is what made writes to `challenges` look like
 * "service-role is subject to RLS" and led to RLS being switched off across
 * the data plane.
 *
 * It presents as "works, then randomly stops": fine after a restart, broken
 * the moment anybody signs in, until the next restart.
 *
 * This greps the source rather than exercising the flow, because the bug is
 * about WHICH CLIENT is used — something a mocked client cannot show.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/** Auth calls that attach a session to the client they run on. */
const SESSION_ATTACHING = ["signInWithPassword", "signUp", "verifyOtp", "setSession"];

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

describe("the shared Supabase client never holds a member session", () => {
  const files = sourceFiles("backend");

  it.each(SESSION_ATTACHING)("never calls %s on the shared client", (method) => {
    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      src.split("\n").forEach((line, i) => {
        // `supabase.auth.<method>` is the shared singleton. A detached
        // client from createAuthClient() is named something else.
        if (line.includes("supabase.auth." + method)) {
          offenders.push(file + ":" + (i + 1));
        }
      });
    }
    expect(
      offenders,
      `${method}() stores its session on the client it is called against. `
        + `Use createAuthClient() so the shared service-role client keeps its own identity.`,
    ).toEqual([]);
  });

  it("still has a detached client available to use instead", () => {
    const config = readFileSync("backend/config/supabase.js", "utf8");
    expect(config).toMatch(/export function createAuthClient/);
    expect(config).toMatch(/persistSession:\s*false/);
  });
});
