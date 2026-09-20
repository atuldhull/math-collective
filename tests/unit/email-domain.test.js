/**
 * Opt-in registration domain gate.
 *
 * Registration accepts any email domain and, without an invite, drops
 * the account into whichever organisation is first in the table. This
 * gate lets the club limit sign-ups to college addresses — but it
 * defaults to OFF, because switching it on mid-intake would lock out
 * faculty and alumni on personal addresses.
 */

import { describe, it, expect } from "vitest";
import { isAllowedEmail, allowedDomainsMessage } from "../../backend/lib/emailDomain.js";

describe("isAllowedEmail", () => {
  it("allows everything when no list is configured (unchanged behaviour)", () => {
    expect(isAllowedEmail("anyone@gmail.com", [])).toBe(true);
    expect(isAllowedEmail("nonsense", [])).toBe(true);
  });

  describe("with bmsit.in configured", () => {
    const domains = ["bmsit.in"];

    it("allows a college address", () => {
      expect(isAllowedEmail("24ug1byai190@bmsit.in", domains)).toBe(true);
    });

    it("allows a subdomain of the college", () => {
      expect(isAllowedEmail("someone@cs.bmsit.in", domains)).toBe(true);
    });

    it("refuses an outside address", () => {
      expect(isAllowedEmail("someone@gmail.com", domains)).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(isAllowedEmail("Someone@BMSIT.IN", domains)).toBe(true);
    });

    it("refuses a lookalike domain that merely ends with the same letters", () => {
      // notbmsit.in ends with "bmsit.in" as a substring — endsWith alone
      // would wave it through, so the check requires a dot boundary.
      expect(isAllowedEmail("attacker@notbmsit.in", domains)).toBe(false);
    });

    it("refuses the domain appearing only in the local part", () => {
      expect(isAllowedEmail("bmsit.in@evil.com", domains)).toBe(false);
    });

    it("refuses an address with no @ at all", () => {
      expect(isAllowedEmail("bmsit.in", domains)).toBe(false);
      expect(isAllowedEmail("", domains)).toBe(false);
      expect(isAllowedEmail(null, domains)).toBe(false);
    });

    it("uses the LAST @ when the local part contains one", () => {
      expect(isAllowedEmail("weird@name@bmsit.in", domains)).toBe(true);
    });
  });

  it("supports several domains", () => {
    const domains = ["bmsit.in", "bmsce.ac.in"];
    expect(isAllowedEmail("a@bmsit.in", domains)).toBe(true);
    expect(isAllowedEmail("b@bmsce.ac.in", domains)).toBe(true);
    expect(isAllowedEmail("c@example.com", domains)).toBe(false);
  });
});

describe("allowedDomainsMessage", () => {
  it("is empty when the gate is off, so nothing is claimed", () => {
    expect(allowedDomainsMessage([])).toBe("");
  });

  it("names the domains and points at the invite route", () => {
    const msg = allowedDomainsMessage(["bmsit.in"]);
    expect(msg).toContain("@bmsit.in");
    expect(msg).toMatch(/invite/i);
  });
});
