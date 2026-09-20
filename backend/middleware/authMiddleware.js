/**
 * middleware/authMiddleware.js
 *
 * Multi-tenant aware auth middleware.
 * Roles: super_admin > admin > teacher > student
 *
 * CRITICAL:  Every protected route injects req.orgId automatically.
 *            All DB queries must filter by req.orgId (done in tenantMiddleware).
 */

import supabase from "../config/supabase.js";
import { logger } from "../config/logger.js";
import { createTtlCache } from "../lib/ttlCache.js";

/* ─────────────────────────────────────
   HELPERS
───────────────────────────────────── */

/** Refresh user record from DB and patch session */
async function refreshSession(req) {
  const { data } = await supabase
    .from("students")
    .select("role, xp, title, org_id, is_active")
    .eq("user_id", req.session.user.id)
    .maybeSingle();

  if (data) {
    req.session.user.role    = data.role    || "student";
    req.session.user.org_id  = data.org_id  || null;
    req.session.user.xp      = data.xp      || 0;
    req.session.user.title   = data.title   || "Axiom Scout";
    req.session.user.is_active = data.is_active;
  }
  return data;
}

/* How stale a cached role / suspension flag may get before we re-read
   it from the database. Role and is_active used to be copied into the
   session at login and trusted for the session's whole 7-day life, so
   demoting an admin or suspending a student did not take effect until
   they happened to log out — a removed admin kept admin access for up
   to a week. Two minutes bounds that window without putting a query on
   every request. */
const REVALIDATE_MS = 2 * 60 * 1000;

/* last_seen_at was written on EVERY authenticated request — thousands
   of writes an hour at 800 users, for a column nobody reads at that
   precision. Once every 5 minutes per user is plenty. */
const PRESENCE_PING_MS = 5 * 60 * 1000;

/**
 * Re-read the authorisation-critical fields if the cached copy is old.
 *
 * Returns "ok" when the session may proceed, or a reason string when it
 * must be torn down. A missing students row is NOT a reason: super_admin
 * legitimately has none (see getProfile's fallback), and treating it as
 * a revocation would lock the platform owner out.
 */
async function revalidateSession(req, now = Date.now()) {
  const user = req.session.user;
  if (user.revalidatedAt && now - user.revalidatedAt < REVALIDATE_MS) return "ok";

  const before = { role: user.role, is_active: user.is_active };

  let fresh;
  try {
    fresh = await refreshSession(req);
  } catch (err) {
    // A database blip must not sign everybody out. Keep the cached copy
    // and try again on the next request.
    logger.warn({ err, userId: user.id }, "Session revalidation failed; keeping cached claims");
    return "ok";
  }

  user.revalidatedAt = now;
  if (!fresh) return "ok";

  // refreshSession defaults a missing role to "student". A row that
  // simply has no role column set would therefore DEMOTE whoever is
  // signed in — so put the cached role back unless the database gave
  // us a real one to replace it with. Only an explicit, different role
  // counts as a change.
  if (!fresh.role) {
    user.role = before.role;
    return "ok";
  }

  if (fresh.is_active === false) return "suspended";
  if (before.role && fresh.role !== before.role) return "role_changed";
  return "ok";
}

/** Tear the session down and tell the client why. */
function revoke(req, res, verdict) {
  const userId = req.session?.user?.id;
  req.session.destroy(() => {});
  logger.info({ userId, verdict }, "Session revoked mid-flight");
  return verdict === "suspended"
    ? res.status(403).json({ error: "Account suspended" })
    : res.status(401).json({
        error: "Your access level changed. Please sign in again.",
        code:  "ROLE_CHANGED",
      });
}

/* ─────────────────────────────────────
   requireAuth — any logged-in user
───────────────────────────────────── */
export const requireAuth = async (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Login required" });
  }

  // Block suspended users
  if (req.session.user.is_active === false) {
    req.session.destroy(() => {});
    return res.status(403).json({ error: "Account suspended" });
  }

  const verdict = await revalidateSession(req);
  if (verdict !== "ok") return revoke(req, res, verdict);

  // Inject orgId for downstream use
  req.orgId = req.session.user.org_id || null;
  req.userId = req.session.user.id;
  req.userRole = req.session.user.role;

  // Best-effort presence ping, throttled per session. It MUST stay
  // non-blocking. The previous .then(()=>{}).catch(()=>{}) buried every
  // error — the students.last_seen_at column didn't exist on the deploy
  // for months and nobody noticed because the .catch ate the "column
  // does not exist" error. Migration 30 added the column; the explicit
  // error log surfaces any FUTURE schema regression to operators.
  const now = Date.now();
  const lastPing = req.session.user.lastPingAt || 0;
  if (now - lastPing > PRESENCE_PING_MS) {
    req.session.user.lastPingAt = now;
    supabase
      .from("students")
      .update({ last_seen_at: new Date(now).toISOString() })
      .eq("user_id", req.userId)
      .then(({ error }) => {
        if (error) logger.warn({ err: error, userId: req.userId }, "last_seen_at update failed (auth middleware)");
      })
      .catch((err) => {
        logger.warn({ err, userId: req.userId }, "last_seen_at update threw (auth middleware)");
      });
  }

  next();
};

/* ─────────────────────────────────────
   requireSuperAdmin — platform owner only
───────────────────────────────────── */
export const requireSuperAdmin = async (req, res, next) => {
  if (!req.session?.user) return res.status(401).json({ error: "Login required" });

  // These guards are mounted WITHOUT requireAuth in front of them
  // (adminRoutes does router.use(requireAdmin) on its own), so each
  // one revalidates for itself. Otherwise the cached role below is
  // trusted for the whole 7-day session life.
  const verdict = await revalidateSession(req);
  if (verdict !== "ok") return revoke(req, res, verdict);

  if (req.session.user.role === "super_admin") {
    req.userId = req.session.user.id;
    req.userRole = "super_admin";
    req.orgId = null; // super_admin has no org
    return next();
  }

  try {
    const data = await refreshSession(req);
    if (data?.role === "super_admin") {
      req.userId   = req.session.user.id;
      req.userRole = "super_admin";
      req.orgId    = null;
      return next();
    }
    return res.status(403).json({ error: "Super admin access required" });
  } catch {
    return res.status(500).json({ error: "Auth check failed" });
  }
};

/* ─────────────────────────────────────
   requireAdmin — org admin OR super_admin
───────────────────────────────────── */
export const requireAdmin = async (req, res, next) => {
  if (!req.session?.user) return res.status(401).json({ error: "Login required" });

  // These guards are mounted WITHOUT requireAuth in front of them
  // (adminRoutes does router.use(requireAdmin) on its own), so each
  // one revalidates for itself. Otherwise the cached role below is
  // trusted for the whole 7-day session life.
  const verdict = await revalidateSession(req);
  if (verdict !== "ok") return revoke(req, res, verdict);

  const role = req.session.user.role;
  if (role === "admin" || role === "super_admin") {
    req.userId   = req.session.user.id;
    req.userRole = role;
    req.orgId    = role === "super_admin" ? null : req.session.user.org_id;
    return next();
  }

  try {
    const data = await refreshSession(req);
    if (data?.role === "admin" || data?.role === "super_admin") {
      req.userId   = req.session.user.id;
      req.userRole = data.role;
      req.orgId    = data.role === "super_admin" ? null : data.org_id;
      return next();
    }
    return res.status(403).json({ error: "Admin access required" });
  } catch {
    return res.status(500).json({ error: "Auth check failed" });
  }
};

/* ─────────────────────────────────────
   requireTeacher — teacher, admin, or super_admin
───────────────────────────────────── */
export const requireTeacher = async (req, res, next) => {
  if (!req.session?.user) return res.status(401).json({ error: "Login required" });

  // These guards are mounted WITHOUT requireAuth in front of them
  // (adminRoutes does router.use(requireAdmin) on its own), so each
  // one revalidates for itself. Otherwise the cached role below is
  // trusted for the whole 7-day session life.
  const verdict = await revalidateSession(req);
  if (verdict !== "ok") return revoke(req, res, verdict);

  const role = req.session.user.role;
  if (["admin", "teacher", "super_admin"].includes(role)) {
    req.userId   = req.session.user.id;
    req.userRole = role;
    req.orgId    = role === "super_admin" ? null : req.session.user.org_id;
    return next();
  }

  try {
    const data = await refreshSession(req);
    if (["admin", "teacher", "super_admin"].includes(data?.role)) {
      req.userId   = req.session.user.id;
      req.userRole = data.role;
      req.orgId    = data.role === "super_admin" ? null : data.org_id;
      return next();
    }
    return res.status(403).json({ error: "Teacher access required" });
  } catch {
    return res.status(500).json({ error: "Auth check failed" });
  }
};

/* ─────────────────────────────────────
   requireSameOrg — enforces user belongs to
   the org being accessed (prevents cross-org access)
   Use on any route that takes :orgId or ?org_id
───────────────────────────────────── */
export const requireSameOrg = (req, res, next) => {
  const userRole = req.session?.user?.role;

  // Super admins can access any org
  if (userRole === "super_admin") return next();

  const targetOrgId = req.params.orgId || req.query.org_id || req.body.org_id;

  if (!targetOrgId) return next(); // no specific org requested, tenantMiddleware will scope

  if (req.session.user.org_id !== targetOrgId) {
    return res.status(403).json({ error: "Cross-organisation access denied" });
  }
  next();
};

/* ─────────────────────────────────────
   checkFeatureFlag — require a specific feature
   enabled for the user's org plan.
   Usage: checkFeatureFlag('ai_tools')
───────────────────────────────────── */
/* An org's plan and flags change on upgrade, so a short TTL is plenty.
   Exported so a plan change can drop the entry immediately rather than
   waiting the minute out. */
export const featureCache = createTtlCache({ ttlMs: 60 * 1000 });

export const checkFeatureFlag = (featureName) => async (req, res, next) => {
  // Super admins bypass all feature flags
  if (req.userRole === "super_admin") return next();

  const orgId = req.orgId;
  if (!orgId) return res.status(403).json({ error: "No organisation context" });

  try {
    // Two queries on EVERY feature-gated request, for values that change
    // when somebody upgrades their plan — not sixty times a second.
    // Cached per org for a minute.
    const { org, plan } = await featureCache.wrap(orgId, async () => {
      const { data: o } = await supabase
        .from("organisations")
        .select("feature_flags, plan_name, status")
        .eq("id", orgId)
        .single();
      if (!o) return { org: null, plan: null };

      const { data: p } = await supabase
        .from("subscription_plans")
        .select("features")
        .eq("name", o.plan_name)
        .maybeSingle();
      return { org: o, plan: p };
    });

    if (!org) return res.status(403).json({ error: "Organisation not found" });
    if (org.status !== "active" && org.status !== "trial") {
      return res.status(403).json({ error: "Organisation account is " + org.status });
    }

    const planFeatures = plan?.features || {};
    const orgOverrides = org.feature_flags || {};

    // org-level override takes precedence over plan
    const allowed = featureName in orgOverrides
      ? orgOverrides[featureName]
      : planFeatures[featureName] ?? false;

    if (!allowed) {
      return res.status(403).json({
        error: `Feature '${featureName}' not available on your current plan`,
        upgrade_required: true,
        current_plan: org.plan_name,
      });
    }

    next();
  } catch (err) {
    logger.error({ err: err }, "checkFeatureFlag");
    return res.status(500).json({ error: "Feature check failed" });
  }
};