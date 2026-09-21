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
import { isAllowedEmail, allowedDomainsMessage} from "../../backend/lib/emailDomain.js";

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

/* ────────────────────────────────────────────────────────────────
   Named exceptions — staff on personal addresses
   ────────────────────────────────────────────────────────────────
   The club's admin, super-admin and teacher accounts are on gmail.com
   and iisc.ac.in. They are verified people, not students, and their
   accounts are explicitly not to be changed — so the domain rule has to
   bend around them rather than the other way round. */
describe("isAllowedEmail — named exceptions", () => {
  const domains = ["bmsit.in"];
  const exceptions = ["atulbizdhull@gmail.com", "satvikaprashanth80@gmail.com"];

  it("lets a listed staff address through on a personal domain", () => {
    expect(isAllowedEmail("atulbizdhull@gmail.com", domains, exceptions)).toBe(true);
    expect(isAllowedEmail("satvikaprashanth80@gmail.com", domains, exceptions)).toBe(true);
  });

  it("still refuses everyone else on that same domain", () => {
    expect(isAllowedEmail("randomstudent@gmail.com", domains, exceptions)).toBe(false);
  });

  it("matches the whole address, not a prefix or the domain part", () => {
    expect(isAllowedEmail("atulbizdhull@gmail.com.evil.com", domains, exceptions)).toBe(false);
    expect(isAllowedEmail("notatulbizdhull@gmail.com", domains, exceptions)).toBe(false);
  });

  it("is case-insensitive, because people type their own address oddly", () => {
    expect(isAllowedEmail("  AtulBizDhull@Gmail.com ", domains, exceptions)).toBe(true);
  });

  it("college addresses still work without being listed", () => {
    expect(isAllowedEmail("24ug1byai190@bmsit.in", domains, exceptions)).toBe(true);
  });

  it("ignores a bare domain accidentally put in the exceptions list", () => {
    // Entries must contain "@" — a bare domain here would silently widen
    // the gate to everyone on it, which is what ALLOWED_EMAIL_DOMAINS is for.
    expect(isAllowedEmail("anyone@gmail.com", domains, ["gmail.com"])).toBe(false);
  });
});
