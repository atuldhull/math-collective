/**
 * controllers/authController.js  (MULTI-TENANT VERSION)
 *
 * Changes from v1:
 *  - Login now fetches org_id, stores in session
 *  - Register can accept org invite token (joins org automatically)
 *  - Session payload includes org_id, org_name
 *  - Role-based redirect updated for super_admin
 */

import supabase, { createAuthClient } from "../config/supabase.js";
import { logger } from "../config/logger.js";
import { SESSION_COOKIE_NAME } from "../middleware/sessionConfig.js";
import { isLocked, recordFailure, recordSuccess } from "../lib/loginAttempts.js";
import { writeAudit, AuditAction } from "../lib/audit.js";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT } from "../lib/passwordPolicy.js";
import { recoveryRedirectUrl, signInRedirectUrl } from "../lib/appUrl.js";
import { isAllowedEmail, isEmailPermitted, allowedDomainsMessage } from "../lib/emailDomain.js";
import { establishUserSession } from "../lib/establishSession.js";

/* Regenerate the session ID before writing user data.
   Defends against session-fixation: an attacker who tricked the victim
   into using an attacker-known anonymous SID can't then "ride" the
   authenticated session, because the SID changes the moment login
   succeeds. Wraps the callback-style express-session API in a Promise. */
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

// Tenant scoping note: auth flows (register, login, getSession,
// validateInvite, resend, forgot/reset) run BEFORE the user has a
// session — req.orgId is undefined, so req.db falls through to the
// unscoped client anyway. We deliberately use raw `supabase` here to
// keep that intent obvious. Where a NEW students row is created,
// org_id is sourced explicitly:
//   - register():  from invitation.org_id (required when no token)
//   - login():     a "first-login" student row used to be auto-created
//                  with org_id=NULL. After migration 14 that fails the
//                  NOT NULL constraint, so we skip the upsert when no
//                  org context is available — login still succeeds and
//                  the operator can attach the user to an org via the
//                  /api/admin/invite flow.

/* ── REGISTER ── */
const register = async (req, res) => {
  try {
    const { name, email, password, invite_token } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });

    // Domain gate (opt-in via ALLOWED_EMAIL_DOMAINS; off by default).
    // Checked BEFORE the invite lookup so the common case is cheap, but
    // an invite overrides it below — that is how faculty and alumni on
    // personal addresses get in.
    if (!invite_token && !isAllowedEmail(email)) {
      return res.status(403).json({ error: allowedDomainsMessage() });
    }

    // Validate invite token if provided
    let invitation = null;
    if (invite_token) {
      const { data: inv } = await supabase
        .from("org_invitations")
        .select("*, organisations(id, name, status)")
        .eq("token", invite_token)
        .eq("accepted", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (!inv) return res.status(400).json({ error: "Invalid or expired invite link" });
      if (inv.email && inv.email !== email.toLowerCase()) {
        return res.status(400).json({ error: "This invite was sent to a different email address" });
      }
      invitation = inv;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name || email.split("@")[0] } },
    });
    if (error) throw error;

    if (data.user) {
      // org_id is REQUIRED post-migration-14. If no invitation token,
      // refuse — open registration without an org context shouldn't
      // create orphan student rows. (For development we fall back to
      // the FIRST org in the system; remove this fallback once invite-
      // gated signup is the production policy.)
      let orgId = invitation?.org_id || null;
      if (!orgId) {
        const { data: org } = await supabase
          .from("organisations").select("id").order("created_at").limit(1).maybeSingle();
        orgId = org?.id || null;
      }
      if (!orgId) {
        return res.status(500).json({ error: "Cannot create account: no organisation configured" });
      }

      const studentRow = {
        user_id:  data.user.id,
        email:    email.toLowerCase(),
        name:     name || email.split("@")[0],
        role:     invitation?.role || "student",
        org_id:   orgId,
      };

      await supabase.from("students").upsert(studentRow, { onConflict: "email" });

      // Mark invitation as accepted
      if (invitation) {
        await supabase
          .from("org_invitations")
          .update({ accepted: true })
          .eq("id", invitation.id);
      }
    }

    return res.json({
      message: "Registered! Check email to verify, then log in.",
      user: data.user,
      org_name: invitation?.organisations?.name || null,
    });
  } catch (err) {
    logger.error({ err: err }, "Register");
    return res.status(400).json({ error: err.message || "Registration failed" });
  }
};

/* ── LOGIN ── */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });

    // Per-email lockout check — cheap, runs BEFORE the Supabase round
    // trip so a locked account doesn't even burn an auth-server hit.
    // Pairs with the IP+email loginLimiter (5/15m): rate limit caps a
    // single IP, lockout caps a single account across all IPs. Five
    // failed attempts in 15 min freezes the account for 15 min.
    const lock = isLocked(email);
    if (lock.locked) {
      res.set("Retry-After", String(lock.retryAfterSec));
      // Locked-and-attempting → audit. Distinguishes "a real user
      // mistyped 6 times" from "we're being credential-stuffed
      // against this account from many IPs".
      writeAudit({
        action:   AuditAction.ACCOUNT_LOCKED,
        metadata: { email: String(email || "").toLowerCase(), retryAfterSec: lock.retryAfterSec },
        req,
      });
      return res.status(429).json({
        error:   "ACCOUNT_LOCKED",
        message: "Too many failed sign-in attempts. Try again in a few minutes or use 'Forgot password'.",
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Credential failure — count it toward the per-email lockout.
      // signInWithPassword returns an "invalid login credentials" error
      // for both wrong-password AND non-existent-email cases, so we
      // never reveal which is the case here (no enumeration). The same
      // logic skips EMAIL_NOT_VERIFIED below: that path only fires
      // AFTER Supabase has confirmed the password is valid.
      if (error.message?.toLowerCase().includes("email not confirmed") ||
          error.message?.toLowerCase().includes("not confirmed")) {
        // Password was correct → don't count this as a failure (the
        // user remembers their password, they just need to verify the
        // email). Successful credential check also resets prior typos.
        recordSuccess(email);
        return res.status(401).json({
          error: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email first.",
        });
      }
      const failState = recordFailure(email);
      // Audit every credential failure. The metadata.email is the
      // string the attacker TRIED; we don't reveal whether it was a
      // real account, just that someone tried it.
      writeAudit({
        action:   AuditAction.LOGIN_FAILED,
        metadata: { email: String(email || "").toLowerCase() },
        req,
      });
      if (failState.locked) {
        res.set("Retry-After", String(failState.retryAfterSec));
        writeAudit({
          action:   AuditAction.ACCOUNT_LOCKED,
          metadata: { email: String(email || "").toLowerCase(), retryAfterSec: failState.retryAfterSec },
          req,
        });
        return res.status(429).json({
          error:   "ACCOUNT_LOCKED",
          message: "Too many failed sign-in attempts. Try again in a few minutes or use 'Forgot password'.",
        });
      }
      throw error;
    }

    if (!data.user?.email_confirmed_at) {
      // Same as the "email not confirmed" branch above — password was
      // valid, so reset typo count and don't penalise the user.
      recordSuccess(email);
      return res.status(401).json({
        error: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email first.",
      });
    }

    // Credential check passed — clear any earlier-typo counter for this
    // address so a flaky session can't drift toward a future lockout.
    recordSuccess(email);

    const authUser = data.user;

    // Fetch the student row WITHOUT a nested organisations join.
    // The earlier version used `select("... organisations(...)")`
    // which in some environments silently returned null when the
    // FK/schema-cache relationship was unhappy — sending login into
    // the auto-create branch below and forcing role=student in the
    // session even when the real row had role=admin. Splitting into
    // two plain queries is more robust.
    const { data: student, error: studentErr } = await supabase
      .from("students")
      .select("name, email, user_id, role, xp, title, org_id, is_active, weekly_xp, department, subject")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (studentErr) {
      logger.error({ err: studentErr, email: authUser.email }, "Login students lookup failed");
    }

    // Fetch org separately. Failure here is non-fatal — session
    // gets org=null and the UI falls back to theme defaults.
    let org = null;
    if (student?.org_id) {
      const { data: orgRow } = await supabase
        .from("organisations")
        .select("id, name, slug, primary_color, status, plan_name, feature_flags")
        .eq("id", student.org_id)
        .maybeSingle();
      org = orgRow || null;
    }

    // Blocked account
    if (student?.is_active === false) {
      return res.status(403).json({ error: "Your account has been suspended. Contact your administrator." });
    }

    // Blocked org
    if (org?.status === "suspended") {
      return res.status(403).json({ error: "Your organisation's account has been suspended." });
    }

    const role  = student?.role  || "student";
    const title = student?.title || "Axiom Scout";
    const xp    = student?.xp    || 0;

    // Create student row if first login. Pre-migration this auto-
    // created an orphan row with org_id=NULL — now NOT NULL, so we
    // pin to the only org as a fallback. In a true multi-tenant world
    // this should NEVER fire (signup creates the row); flagging via
    // log so we can audit any user that hits this path.
    if (!student) {
      const { data: defaultOrg } = await supabase
        .from("organisations").select("id").order("created_at").limit(1).maybeSingle();
      if (defaultOrg?.id) {
        logger.warn({ email: authUser.email, orgId: defaultOrg.id }, "Login auto-creating student row — register flow should have done this");
        await supabase.from("students").upsert({
          user_id: authUser.id,
          email:   authUser.email.toLowerCase(),
          name:    authUser.user_metadata?.name || authUser.email.split("@")[0],
          org_id:  defaultOrg.id,
        }, { onConflict: "email" });
      }
    }

    // Session-fixation defence: rotate the session ID before writing
    // the authenticated user. Without this, an attacker who handed the
    // victim an anon SID (via XSS, an open redirect, or a phishing
    // login-link) could ride the session post-auth using the same SID.
    // Regenerating destroys the pre-auth session and starts a fresh one
    // — the SID the attacker knew is now dead. Done AFTER all the
    // student/org lookups so a Supabase blip can't leave the user with
    // a regenerated-but-empty session.
    try {
      await regenerateSession(req);
    } catch (regenErr) {
      logger.error({ err: regenErr, email: authUser.email }, "Login: session.regenerate failed");
      return res.status(500).json({ error: "Login failed — please try again" });
    }

    // Set session — includes org context
    req.session.user = {
      id:         authUser.id,
      email:      authUser.email,
      name:       student?.name || authUser.user_metadata?.name || authUser.email.split("@")[0],
      role,
      title,
      xp,
      org_id:     student?.org_id  || null,
      org_name:   org?.name        || null,
      org_slug:   org?.slug        || null,
      org_color:  org?.primary_color || "#7c3aed",
      org_plan:   org?.plan_name   || "free",
      is_active:  student?.is_active ?? true,
    };

    logger.info({ email: authUser.email, role, org: org?.name || null }, "Login successful");

    // Audit the successful login. The metadata email is informational
    // for the operator; the user_id + IP are the primary search keys
    // on /super-admin/audit-logs.
    writeAudit({
      actorId:    authUser.id,
      actorRole:  role,
      orgId:      student?.org_id || null,
      action:     AuditAction.LOGIN_SUCCESS,
      targetType: "user",
      targetId:   authUser.id,
      metadata:   { email: authUser.email },
      req,
    });

    // Best-effort presence ping. Doesn't await — login must not
    // block on a presence write. The old version silently dropped
    // the result with .then(()=>{}), which masked the fact that
    // the students.last_seen_at column didn't exist on the deploy
    // for months (every login was firing a failed UPDATE). Migration
    // 30 added the column; the .catch here surfaces any FUTURE
    // schema-regression to operators via the structured logger
    // (the global error handler isn't on this path because we're
    // not awaiting).
    supabase.from("students")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", authUser.id)
      .then(({ error }) => {
        if (error) logger.warn({ err: error, userId: authUser.id }, "last_seen_at update failed (login)");
      });

    // Role-based redirect
    const redirectMap = {
      super_admin: "/super-admin",
      admin:       "/admin",
      teacher:     "/teacher",
      student:     "/dashboard",
    };
    const redirectTo = redirectMap[role] || "/dashboard";

    return res.json({
      message: "Login successful",
      user: req.session.user,
      redirectTo,
    });

  } catch (err) {
    logger.error({ err: err }, "Login");
    return res.status(401).json({ error: "Invalid email or password" });
  }
};

/* ── LOGOUT (shared helper) ──
   clearCookie name MUST match sessionConfig.SESSION_COOKIE_NAME or the
   browser will keep the dead session cookie alive (orphaned but
   present), making "logout actually logs out" lukewarm. Imported as a
   constant so a future rename is a one-line change. */
function destroySession(req, res, onSuccess) {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.clearCookie(SESSION_COOKIE_NAME);
    onSuccess();
  });
}

const logout = (req, res) => {
  destroySession(req, res, () => res.json({ message: "Logged out" }));
};

const logoutRedirect = (req, res) => {
  destroySession(req, res, () => res.redirect("/"));
};

/* ── RESEND VERIFICATION ──
   No-enumeration: we ALWAYS return the same success shape regardless
   of whether the email exists, is already verified, or is junk. The
   previous version forwarded Supabase's error.message verbatim, which
   could distinguish "user not found" from "already verified" from
   "rate limited" — letting an attacker probe the user table one
   address at a time. Real outcomes are still logged server-side so an
   operator can debug a legitimately-stuck user. */
const resendVerification = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  try {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      // Log the real reason, hand the user a generic OK. The most
      // common cause is Supabase's own rate-limit; the user can wait
      // and retry without us telling them their address was found.
      logger.info({ email, reason: error.message }, "resendVerification: upstream declined (response masked)");
    }
  } catch (err) {
    logger.error({ err, email }, "resendVerification: unexpected error (response masked)");
  }
  return res.json({
    success: true,
    message: "If that address has an unverified account, we've sent a new verification email. Check your inbox.",
  });
};

/* ── GET SESSION (client polls this to check login state) ── */
const getSession = (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: "Not logged in" });
  return res.json({ user: req.session.user });
};

/* ── VALIDATE INVITE TOKEN ── */
const validateInvite = async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Token required" });

  const { data } = await supabase
    .from("org_invitations")
    .select("email, role, organisations(name, primary_color)")
    .eq("token", token)
    .eq("accepted", false)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return res.status(404).json({ error: "Invalid or expired invite" });

  return res.json({
    valid: true,
    email: data.email,
    role:  data.role,
    org:   data.organisations,
  });
};

/* ── SIGN IN WITH A COLLEGE EMAIL + CODE ──────────────────────────────
   Two steps: requestSignInCode mails a 6-digit code, verifySignInCode
   checks it and signs the person in.

   Why this exists alongside the password flow:
     - Members were bulk-imported from a Google Form CSV. That writes a
       students row with no Supabase Auth account, so an imported member
       could only ever link up by registering with the byte-identical
       email — and then still had to survive the verification email.
       Proving control of the mailbox lets us CLAIM their existing row
       (see lib/establishSession.js), XP and history intact.
     - The form collected personal addresses as well as college ones, so
       a row could never match the address its owner actually signs in
       with. Restricting to the college domain removes that whole class
       of mismatch.
     - A code proves the mailbox is real and belongs to whoever is
       typing. That is the "is this a real student" check, and it
       replaces a verification LINK that could break in transit.

   The domain restriction is ALLOWED_EMAIL_DOMAINS (lib/emailDomain.js).
   With it unset these endpoints still work but accept any address. */
const requestSignInCode = async (req, res) => {
  const { email } = req.body;

  // Refuse non-college addresses BEFORE mailing anything, so this can
  // never be used to send a code to an arbitrary inbox.
  if (!(await isEmailPermitted(email))) {
    logger.info({ email }, "signInCode: refused non-college address");
    return res.status(403).json({
      error: allowedDomainsMessage() || "That email address is not eligible to sign in.",
    });
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // A member who has never signed in still needs an auth account
        // creating — that is the whole point for CSV-imported rows.
        shouldCreateUser: true,
        emailRedirectTo:  signInRedirectUrl(req),
      },
    });
    if (error) {
      // Masked for the same no-enumeration reason as forgotPassword:
      // the response must not reveal whether the address is on file.
      logger.info({ email, reason: error.message }, "signInCode: upstream declined (response masked)");
    }
  } catch (err) {
    logger.error({ err, email }, "signInCode: unexpected error (response masked)");
  }

  return res.json({
    success: true,
    message: "If that address is a valid college email, a 6-digit code is on its way. It expires in 1 hour.",
  });
};

/* ── VERIFY THE CODE AND SIGN IN ── */
const verifySignInCode = async (req, res) => {
  const { email, token } = req.body;

  if (!(await isEmailPermitted(email))) {
    return res.status(403).json({
      error: allowedDomainsMessage() || "That email address is not eligible to sign in.",
    });
  }

  // The per-email lockout that guards password login guards this too — a
  // 6-digit code is only a million guesses, so an unthrottled verify
  // endpoint is a brute-force target.
  const lock = isLocked(email);
  if (lock.locked) {
    res.set("Retry-After", String(lock.retryAfterSec));
    return res.status(429).json({
      error:   "ACCOUNT_LOCKED",
      message: "Too many incorrect codes. Try again in a few minutes.",
    });
  }

  try {
    // Detached client: verifyOtp signs ITS client in as the user, and
    // doing that to the shared service-role singleton would leave every
    // later admin query in the process carrying a member's JWT.
    const authClient = createAuthClient();
    const { data, error } = await authClient.auth.verifyOtp({
      email,
      token: String(token).trim(),
      type:  "email",
    });

    if (error || !data?.user) {
      const failState = recordFailure(email);
      writeAudit({ action: AuditAction.LOGIN_FAILED, metadata: { email, via: "code" }, req });
      if (failState.locked) {
        res.set("Retry-After", String(failState.retryAfterSec));
        return res.status(429).json({
          error:   "ACCOUNT_LOCKED",
          message: "Too many incorrect codes. Try again in a few minutes.",
        });
      }
      return res.status(401).json({ error: "That code is wrong or has expired. Request a new one." });
    }

    recordSuccess(email);

    const result = await establishUserSession(req, data.user);
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    logger.info({ email, claimed: result.claimed, role: result.user.role }, "Code sign-in successful");
    writeAudit({
      actorId:    data.user.id,
      actorRole:  result.user.role,
      orgId:      result.user.org_id,
      action:     AuditAction.LOGIN_SUCCESS,
      targetType: "user",
      targetId:   data.user.id,
      metadata:   { email, via: "code", claimedImportedRow: result.claimed },
      req,
    });

    return res.json({
      success:    true,
      user:       result.user,
      redirectTo: result.redirectTo,
      // Lets the UI say "welcome back, we found your existing profile"
      // rather than treating a long-standing member as brand new.
      claimed:    result.claimed,
    });
  } catch (err) {
    logger.error({ err, email }, "verifySignInCode");
    return res.status(500).json({ error: "Sign-in failed — please try again" });
  }
};

/* ── FORGOT PASSWORD ──
   No-enumeration: same shape regardless of whether the address is on
   file. Supabase's resetPasswordForEmail is already silent on hit/miss
   by design — but the previous code surfaced its `error.message` on
   rate-limit / network failure, which over time would leak the
   account-state distribution. Mask the upstream and always say "if
   that address exists, we sent it". */
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryRedirectUrl(req),
    });
    if (error) {
      logger.info({ email, reason: error.message }, "forgotPassword: upstream declined (response masked)");
    }
  } catch (err) {
    logger.error({ err, email }, "forgotPassword: unexpected error (response masked)");
  }
  return res.json({
    success: true,
    message: "If an account exists for that address, a password-reset email is on its way. Check your inbox (and spam folder).",
  });
};

/* ── RESET PASSWORD (using a Supabase recovery token) ──
   Accepts either token shape a recovery link can carry:
     - access_token — implicit flow, arrives in the URL fragment
     - token_hash   — OTP-hash flow, arrives as a query param
   Whichever the project's email template uses, the member lands on the
   same form and this endpoint resolves it to a user id.

   Both lookups run on a DETACHED client (createAuthClient) rather than
   the shared service-role singleton: verifyOtp signs that client in as
   the user, and doing that to the singleton left every later admin
   query in the process carrying a member's JWT. */
const resetPassword = async (req, res) => {
  const { access_token, token_hash, new_password } = req.body;
  if (!access_token && !token_hash) {
    return res.status(400).json({ error: "Reset token and new password required" });
  }
  if (!new_password) return res.status(400).json({ error: "Reset token and new password required" });
  if (new_password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: PASSWORD_TOO_SHORT });
  }

  const EXPIRED = "This reset link has expired or has already been used. Request a new one from the sign-in page.";

  try {
    const authClient = createAuthClient();
    let user = null;

    if (access_token) {
      const { data, error } = await authClient.auth.getUser(access_token);
      if (error || !data?.user) return res.status(400).json({ error: EXPIRED });
      user = data.user;
    } else {
      const { data, error } = await authClient.auth.verifyOtp({
        token_hash,
        type: "recovery",
      });
      if (error || !data?.user) return res.status(400).json({ error: EXPIRED });
      user = data.user;
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: new_password,
    });
    if (updateError) return res.status(500).json({ error: updateError.message });

    logger.info({ email: user.email }, "Password reset completed");
    // Audit the recovery-token reset. Pre-session flow → actor_id is
    // the user being reset (from the recovery token), no role yet.
    writeAudit({
      actorId:    user.id,
      action:     AuditAction.PASSWORD_RESET,
      targetType: "user",
      targetId:   user.id,
      metadata:   { email: user.email, via: access_token ? "recovery_token" : "token_hash" },
      req,
    });
    return res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    logger.error({ err: err }, "Reset Password");
    return res.status(500).json({ error: "Password reset failed" });
  }
};

export default {
  register,
  login,
  logout,
  logoutRedirect,
  resendVerification,
  getSession,
  validateInvite,
  requestSignInCode,
  verifySignInCode,
  forgotPassword,
  resetPassword,
};
