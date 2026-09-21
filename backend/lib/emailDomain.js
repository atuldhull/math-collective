/**
 * lib/emailDomain.js — optionally restrict who may register.
 *
 * Registration accepts any email domain, and an account created without
 * an invite silently joins whichever organisation happens to be first in
 * the table. For a college society whose members all hold @bmsit.in
 * mailboxes, that is wider than it needs to be.
 *
 * This is OPT-IN and defaults to off, because turning it on is a policy
 * decision with real consequences during an intake: set
 * ALLOWED_EMAIL_DOMAINS and anyone whose address is outside the list can
 * no longer sign up, including faculty and alumni on personal addresses.
 * Leave it unset and behaviour is exactly as before.
 *
 *   ALLOWED_EMAIL_DOMAINS=bmsit.in
 *   ALLOWED_EMAIL_DOMAINS=bmsit.in,bmsce.ac.in
 *
 * An invite token always wins: someone explicitly invited by an admin is
 * let in whatever their address, which is how faculty and alumni come in.
 *
 * So does holding a role above student — see isEmailPermitted at the
 * bottom of this file. Teachers, admins and the super-admin keep access
 * on whatever address they already use, without anyone maintaining a
 * list of them.
 */

import supabase from "../config/supabase.js";
import { logger } from "../config/logger.js";

export function allowedDomains() {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS || "";
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/**
 * Individual addresses allowed regardless of domain.
 *
 * The club's admins, super-admin and teachers signed up on personal
 * addresses. They are verified people rather than students, their
 * accounts are not to be changed, and asking them to move address would
 * be worse than the problem it solves — so their exact addresses are
 * listed here and keep working on every sign-in path.
 *
 *   ALLOWED_EMAIL_EXCEPTIONS=someone@gmail.com,prof@iisc.ac.in
 *
 * Exact addresses only, never a bare domain — a domain belongs in
 * ALLOWED_EMAIL_DOMAINS. Keep the list short: every entry is a standing
 * exception to the rule that only college addresses get in.
 */
export function allowedExceptions() {
  const raw = process.env.ALLOWED_EMAIL_EXCEPTIONS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
}

/**
 * True when `email` may register WITHOUT an invite, or use code sign-in.
 * With no domain list configured, everything is allowed (the default).
 */
export function isAllowedEmail(
  email,
  domains = allowedDomains(),
  exceptions = allowedExceptions(),
) {
  if (domains.length === 0) return true;

  const address = String(email || "").toLowerCase().trim();
  if (exceptions.includes(address)) return true;

  const at = address.lastIndexOf("@");
  if (at === -1) return false;
  const host = address.slice(at + 1);
  // Exact match, or a subdomain of an allowed domain.
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function allowedDomainsMessage(domains = allowedDomains()) {
  if (domains.length === 0) return "";
  const list = domains.map((d) => `@${d}`).join(" or ");
  return `Sign-ups are limited to ${list} addresses. If you need access with a different address, ask an admin for an invite link.`;
}

/* Anyone who is not a plain student. These are people the club has
   already vetted — they were promoted by an admin — so the college-only
   rule does not apply to them. */
export const PRIVILEGED_ROLES = Object.freeze(["teacher", "admin", "super_admin"]);

/**
 * The real gate: may this address sign in / register?
 *
 * Allows, in order of cost:
 *   1. anything, when no domain restriction is configured;
 *   2. an address on an allowed domain, or one named explicitly in
 *      ALLOWED_EMAIL_EXCEPTIONS — both decided in memory;
 *   3. an address belonging to an existing account whose role is above
 *      student, which costs one indexed lookup.
 *
 * Rule 3 is why there is no list of staff addresses to maintain. The
 * club's admins, super-admin and teachers are on personal addresses and
 * their accounts are not being changed; hardcoding them would go stale
 * the first time somebody new is promoted on a gmail.com address. Role
 * is the thing that actually means "this person is vetted", so that is
 * what gets checked.
 *
 * A failed lookup denies rather than allows: if the database is
 * unreachable we would rather refuse a staff member (who can still use
 * a password) than let the restriction silently stop applying.
 */
export async function isEmailPermitted(email) {
  if (isAllowedEmail(email)) return true;

  const address = String(email || "").toLowerCase().trim();
  if (!address.includes("@")) return false;

  try {
    const { data, error } = await supabase
      .from("students")
      .select("role")
      // ilike, not eq: rows imported from the CSV were never normalised
      // to lowercase, so an exact match would miss "Name@Gmail.com".
      .ilike("email", address)
      .in("role", PRIVILEGED_ROLES)
      .maybeSingle();

    if (error) {
      logger.warn({ err: error, email: address }, "isEmailPermitted: role lookup failed — denying");
      return false;
    }
    return Boolean(data);
  } catch (err) {
    logger.warn({ err, email: address }, "isEmailPermitted: role lookup threw — denying");
    return false;
  }
}
