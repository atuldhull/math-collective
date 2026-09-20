/**
 * Who may act on whom.
 *
 * Regression guard for the admin-takeover hole: the admin user routes
 * proved the CALLER was staff and then passed a raw :userId to
 * Supabase's admin API, so any admin could reset the super-admin's
 * password and sign in as them.
 */

import { describe, it, expect } from "vitest";
import { outranks, rankOf } from "../../backend/lib/roleHierarchy.js";

describe("outranks", () => {
  it("refuses an admin acting on the super-admin", () => {
    expect(outranks("admin", "super_admin")).toBe(false);
  });

  it("refuses an admin acting on a peer admin", () => {
    expect(outranks("admin", "admin")).toBe(false);
  });

  it("allows an admin acting on a teacher or student", () => {
    expect(outranks("admin", "teacher")).toBe(true);
    expect(outranks("admin", "student")).toBe(true);
  });

  it("lets the super-admin act on anyone below them", () => {
    expect(outranks("super_admin", "admin")).toBe(true);
    expect(outranks("super_admin", "super_admin")).toBe(false);
  });

  it("treats an unknown or missing role as the lowest rank", () => {
    expect(rankOf(undefined)).toBe(0);
    expect(rankOf("nonsense")).toBe(0);
    expect(outranks(undefined, "student")).toBe(false);
    expect(outranks("student", undefined)).toBe(true);
  });
});
