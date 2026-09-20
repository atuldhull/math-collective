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
 */

export function allowedDomains() {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS || "";
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/**
 * True when `email` may register WITHOUT an invite.
 * With no list configured, everything is allowed (current behaviour).
 */
export function isAllowedEmail(email, domains = allowedDomains()) {
  if (domains.length === 0) return true;
  const at = String(email || "").toLowerCase().lastIndexOf("@");
  if (at === -1) return false;
  const host = String(email).toLowerCase().slice(at + 1);
  // Exact match, or a subdomain of an allowed domain.
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function allowedDomainsMessage(domains = allowedDomains()) {
  if (domains.length === 0) return "";
  const list = domains.map((d) => `@${d}`).join(" or ");
  return `Sign-ups are limited to ${list} addresses. If you need access with a different address, ask an admin for an invite link.`;
}
