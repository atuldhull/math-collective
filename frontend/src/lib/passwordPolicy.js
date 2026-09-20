/**
 * Mirror of backend/lib/passwordPolicy.js.
 *
 * Kept in sync by hand (the two halves ship as separate bundles). The
 * point is that every form that sets a password states the SAME rule
 * the server enforces, so nobody discovers the rule by being rejected.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_HELPER = `At least ${MIN_PASSWORD_LENGTH} characters`;
export const PASSWORD_TOO_SHORT = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
