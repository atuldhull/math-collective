/**
 * lib/establishSession.js — turn a verified Supabase auth user into a
 * signed-in session.
 *
 * Extracted so password login and code login build the SAME session.
 * Two auth paths that each assembled `req.session.user` by hand would
 * drift, and a field missing on one path (org_id, role, is_active) is
 * exactly the kind of bug that only shows up as a weird permission
 * failure three screens later.
 *
 * It does NOT verify credentials — the caller has already done that,
 * whether by password or by emailed code. Its job starts at "this
 * person is who they say they are".
 */

import supabase from "../config/supabase.js";
import { logger } from "../config/logger.js";

/* Regenerate the session ID before writing user data. Defends against
   session-fixation: an attacker who tricked the victim into using an
   attacker-known anonymous SID can't then ride the authenticated
   session, because the SID changes the moment auth succeeds. */
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

const REDIRECT_BY_ROLE = {
  super_admin: "/super-admin",
  admin:       "/admin",
  teacher:     "/teacher",
};

/**
 * Find this person's students row, claiming an imported one if needed.
 *
 * Members were bulk-imported from a Google Form CSV, which writes a
 * students row with NO user_id — adding a row does not create a
 * Supabase Auth account. Those rows are invisible to a user_id lookup,
 * so an imported member logging in for the first time looked like a
 * brand-new user and their XP, history and role stayed orphaned on the
 * old row.
 *
 * So: look up by user_id first (the normal case), and fall back to an
 * unclaimed row with the same email. Matching on email is safe here
 * precisely because the caller has just PROVEN control of that mailbox.
 * Only rows with user_id IS NULL are claimable, so this can never steal
 * a row that already belongs to somebody.
 */
async function findOrClaimStudent(authUser) {
  const email = (authUser.email || "").toLowerCase();

  const { data: byId, error: byIdErr } = await supabase
    .from("students")
    .select("name, email, user_id, role, xp, title, org_id, is_active, weekly_xp, department, subject")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (byIdErr) logger.error({ err: byIdErr, email }, "establishSession: students lookup by user_id failed");
  if (byId) return { student: byId, claimed: false };

  const { data: unclaimed } = await supabase
    .from("students")
    .select("name, email, user_id, role, xp, title, org_id, is_active, weekly_xp, department, subject")
    .eq("email", email)
    .is("user_id", null)
    .maybeSingle();

  if (!unclaimed) return { student: null, claimed: false };

  const { error: claimErr } = await supabase
    .from("students")
    .update({ user_id: authUser.id })
    .eq("email", email)
    .is("user_id", null);          // re-checked, so a race cannot double-claim

  if (claimErr) {
    logger.error({ err: claimErr, email }, "establishSession: claim failed");
    return { student: null, claimed: false };
  }

  logger.info({ email, userId: authUser.id, xp: unclaimed.xp }, "Imported member claimed their row");
  return { student: { ...unclaimed, user_id: authUser.id }, claimed: true };
}

/**
 * Build the session. Returns either
 *   { ok: true,  user, redirectTo, claimed }
 * or
 *   { ok: false, status, error }
 * so the caller decides the HTTP shape.
 */
export async function establishUserSession(req, authUser) {
  const { student, claimed } = await findOrClaimStudent(authUser);

  let org = null;
  if (student?.org_id) {
    const { data: orgRow } = await supabase
      .from("organisations")
      .select("id, name, slug, primary_color, status, plan_name, feature_flags")
      .eq("id", student.org_id)
      .maybeSingle();
    org = orgRow || null;
  }

  if (student?.is_active === false) {
    return { ok: false, status: 403, error: "Your account has been suspended. Contact your administrator." };
  }
  if (org?.status === "suspended") {
    return { ok: false, status: 403, error: "Your organisation's account has been suspended." };
  }

  // No row at all — a genuinely new member. org_id is NOT NULL since
  // migration 14, so pin to the only org rather than writing an orphan.
  let effectiveStudent = student;
  if (!student) {
    const { data: defaultOrg } = await supabase
      .from("organisations").select("id").order("created_at").limit(1).maybeSingle();
    if (defaultOrg?.id) {
      const row = {
        user_id: authUser.id,
        email:   (authUser.email || "").toLowerCase(),
        name:    authUser.user_metadata?.name || (authUser.email || "").split("@")[0],
        org_id:  defaultOrg.id,
      };
      const { error: insErr } = await supabase.from("students").upsert(row, { onConflict: "email" });
      if (insErr) logger.error({ err: insErr, email: row.email }, "establishSession: student create failed");
      else effectiveStudent = { ...row, role: "student", xp: 0, title: "Axiom Scout", is_active: true };
    }
  }

  const role  = effectiveStudent?.role  || "student";
  const title = effectiveStudent?.title || "Axiom Scout";
  const xp    = effectiveStudent?.xp    || 0;

  try {
    await regenerateSession(req);
  } catch (err) {
    logger.error({ err, email: authUser.email }, "establishSession: session.regenerate failed");
    return { ok: false, status: 500, error: "Sign-in failed — please try again" };
  }

  req.session.user = {
    id:         authUser.id,
    email:      authUser.email,
    name:       effectiveStudent?.name || authUser.user_metadata?.name || (authUser.email || "").split("@")[0],
    role,
    title,
    xp,
    org_id:     effectiveStudent?.org_id || null,
    org_name:   org?.name          || null,
    org_slug:   org?.slug          || null,
    org_color:  org?.primary_color || "#7c3aed",
    org_plan:   org?.plan_name     || "free",
    is_active:  effectiveStudent?.is_active ?? true,
  };

  // Best-effort presence ping; never block sign-in on it.
  supabase.from("students")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("user_id", authUser.id)
    .then(({ error }) => {
      if (error) logger.warn({ err: error, userId: authUser.id }, "last_seen_at update failed (sign-in)");
    })
    .catch(() => {});

  return {
    ok: true,
    claimed,
    user: req.session.user,
    redirectTo: REDIRECT_BY_ROLE[role] || "/dashboard",
  };
}

export const __testing = { findOrClaimStudent, REDIRECT_BY_ROLE };
