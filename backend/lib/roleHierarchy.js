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

/**
 * True when `actorRole` may change roles for someone of `targetRole`,
 * and when it may hand out `targetRole` as a new role.
 *
 * Deliberately looser than outranks(): peers are allowed, so an admin can
 * promote someone to admin and can change another admin's role. Running a
 * club means handing out staff access, and requiring the single
 * super_admin for every promotion made that a bottleneck.
 *
 * What it still refuses is reaching UP: an admin cannot change a
 * super_admin's role, and cannot grant super_admin. That keeps the top of
 * the hierarchy out of reach of a compromised admin session.
 *
 * Note this governs role changes only. Resetting a password or deleting
 * an account still goes through outranks(), because those take over an
 * account outright rather than adjusting what it may do.
 */
export function canManageRole(actorRole, targetRole) {
  return rankOf(actorRole) >= rankOf(targetRole);
}
