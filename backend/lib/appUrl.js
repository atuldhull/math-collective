/**
 * lib/appUrl.js — where a password-reset email should send people back to.
 *
 * The old code built that link from the incoming request:
 *   `${req.protocol}://${req.get("host")}/login`
 * which was wrong in three ways on the deployed site.
 *
 *   1. THE PATH. The SPA is mounted at /app/ (vite `base: "/app/"`,
 *      React Router `basename="/app"`). A bare /login is served
 *      index.html by the catch-all in app.js, but React Router then
 *      tries to match "/login" against a table whose routes all live
 *      under /app — no match, so the member landed on the 404 page with
 *      their recovery token stranded in the URL fragment. This is the
 *      "I clicked the reset link and nothing happened" report.
 *   2. THE HOST. `req.get("host")` is whatever Host header reached the
 *      API, which is not necessarily where the site lives.
 *   3. THE PAGE. /login is wrapped in GuestOnlyRoute, so a member still
 *      signed in on that device was redirected to their dashboard
 *      before any reset form could render.
 *
 * FRONTEND_URL is the deployed site origin and is a required env var
 * (config/env.js), so it is the authoritative answer for the origin.
 * The request is only a fallback for local dev.
 *
 * NOTE: whatever this returns must ALSO be listed under
 * Authentication → URL Configuration → Redirect URLs in the Supabase
 * dashboard. Supabase silently drops a redirectTo that is not on that
 * allowlist and falls back to the project's Site URL.
 */

/* Must match vite's `base` / React Router's basename. If the SPA mount
   ever moves, this moves with it or reset links break again. */
export const SPA_MOUNT = "/app";
export const RECOVERY_PATH = `${SPA_MOUNT}/reset-password`;

export function appOrigin(req) {
  const fromEnv = process.env.FRONTEND_URL || process.env.PUBLIC_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (req) return `${req.protocol}://${req.get("host")}`;
  return "";
}

/* Where a SIGN-IN code email should point if the template also carries
   a link. Not the recovery page — that form asks for a new password,
   which is nonsense for somebody who just wanted to sign in. */
export const SIGN_IN_PATH = `${SPA_MOUNT}/login`;

export function signInRedirectUrl(req) {
  return `${appOrigin(req)}${SIGN_IN_PATH}`;
}

export function recoveryRedirectUrl(req) {
  return `${appOrigin(req)}${RECOVERY_PATH}`;
}
