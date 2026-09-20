/**
 * lib/roleHierarchy.js — who is allowed to act on whom.
 *
 * `requireAdmin` proves the CALLER is staff. It says nothing about the
 * TARGET, and the admin user routes never checked: reset-password and
 * delete-user passed a raw `:userId` straight to Supabase's admin API.
 * Any admin — or anyone who stole an admin session — could reset the
 * super-admin's password and sign in as them, or delete accounts
 * belonging to a different organisation.
 *
 * Two rules close that, and both must hold:
 *   1. SAME ORG. The target is loaded through the org-scoped `req.db`,
 *      so a row outside the caller's organisation simply isn't found.
 *      (super_admin runs unscoped by design and is exempt.)
 *   2. STRICTLY LOWER RANK. You may only act on someone below you.
 *      Admin-on-admin is refused too, so one compromised admin account
 *      cannot quietly neutralise the others.
 */

export const ROLE_RANK = Object.freeze({
  student:     1,
  teacher:     2,
  admin:       3,
  super_admin: 4,
});

export function rankOf(role) {
  return ROLE_RANK[role] || 0;
}

/**
 * True when `actorRole` may perform a privileged action on `targetRole`.
 * Equal ranks are refused — an admin cannot reset another admin.
 */
export function outranks(actorRole, targetRole) {
  return rankOf(actorRole) > rankOf(targetRole);
}
