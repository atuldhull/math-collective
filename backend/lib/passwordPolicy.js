/**
 * lib/passwordPolicy.js — one source of truth for "how long must a new
 * password be".
 *
 * Why this file exists: the floor used to be declared in four places
 * and they disagreed. register/reset accepted 6 chars, the in-session
 * change-password endpoint demanded 8, and the profile UI advertised
 * nothing at all. A member who picked a 6-char password at signup and
 * then tried to change it got a 400 the UI rendered as a generic
 * "Failed to change password" — which is why people reported that
 * changing a password simply did not work.
 *
 * The floor is now 8 EVERYWHERE a new password is set (register,
 * recovery reset, in-session change, admin reset). Login deliberately
 * has no floor: existing accounts created under the old 6-char rule
 * must still be able to sign in. They only meet the new rule the next
 * time they set a password.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export const PASSWORD_TOO_SHORT =
  `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
export const PASSWORD_TOO_LONG =
  `Password must be at most ${MAX_PASSWORD_LENGTH} characters`;
