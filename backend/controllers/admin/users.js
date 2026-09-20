import supabase from "../../config/supabase.js";
import { logger } from "../../config/logger.js";
import { toCsv, fetchAll, CSV_BOM } from "../../lib/exportHelpers.js";
import { outranks } from "../../lib/roleHierarchy.js";
import { writeAudit, AuditAction } from "../../lib/audit.js";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT } from "../../lib/passwordPolicy.js";

/* ═══════════════════════════════════════════
   USERS — Get all students
   GET /api/admin/users
═══════════════════════════════════════════ */
export const getAllUsers = async (req, res) => {
  try {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const from  = (page - 1) * limit;

    const { data, count, error } = await req.db
      .from("students")
      .select("id, user_id, name, email, xp, title, role, department, subject, is_active, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);

    if (error) {
      logger.error({ err: error, adminId: req.session?.user?.id }, "getAllUsers query failed");
      return res.status(500).json({ error: error.message });
    }

    // Diagnostic: admins report "teachers/members tab empty". The
    // students table is tenant-scoped via the req.db proxy, so this
    // log reveals whether the filter is simply returning zero rows
    // (org mismatch between the viewing admin and the student rows)
    // vs. an actual DB error or RLS issue.
    logger.info({
      adminId: req.session?.user?.id || null,
      orgId:   req.orgId || null,
      role:    req.userRole || null,
      count:   data?.length || 0,
      total:   count || 0,
      page,
    }, "getAllUsers: tenant-scoped count");

    return res.json({ users: data || [], total: count || 0, page, limit });
  } catch (err) {
    logger.error({ err }, "getAllUsers");
    return res.status(500).json({ error: "Failed to fetch users" });
  }
};

/* ═══════════════════════════════════════════
   USERS — Export the whole roster as CSV
   GET /api/admin/users/export
   Built server-side via fetchAll so it is never cut off by the list
   endpoint's 100-per-page cap or PostgREST's 1000-row cap.
═══════════════════════════════════════════ */
export const exportUsers = async (req, res) => {
  try {
    const rows = await fetchAll(() =>
      req.db
        .from("students")
        .select("user_id, name, email, role, title, department, subject, xp, weekly_xp, is_active, created_at")
        .order("created_at", { ascending: false })
        .order("user_id", { ascending: true }),
    );
    const csv = toCsv(rows, [
      "name",
      "email",
      { key: "role", label: "role", value: (r) => r.role || "student" },
      "title",
      "department",
      "subject",
      { key: "xp", label: "xp", value: (r) => r.xp ?? 0 },
      { key: "weekly_xp", label: "weekly_xp", value: (r) => r.weekly_xp ?? 0 },
      { key: "status", label: "status", value: (r) => (r.is_active === false ? "inactive" : "active") },
      { key: "joined", label: "joined", value: (r) => (r.created_at ? String(r.created_at).slice(0, 10) : "") },
      "user_id",
    ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="users_export_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send(CSV_BOM + csv);
  } catch (err) {
    logger.error({ err, adminId: req.session?.user?.id }, "exportUsers");
    return res.status(500).json({ error: "Failed to export users" });
  }
};

/* ═══════════════════════════════════════════
   USERS — Create new user (admin)
   POST /api/admin/users/create
═══════════════════════════════════════════ */
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role = "student", department, subject } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!["student", "teacher", "admin"].includes(role)) {
      return res.status(400).json({ error: "role must be 'student', 'teacher' or 'admin'" });
    }

    // Create in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,  // skip email verification for admin-created accounts
      user_metadata: { name: name || email.split("@")[0] },
    });

    if (authError) return res.status(500).json({ error: authError.message });

    const userId = authData.user.id;

    // Upsert into students table
    const { error: dbError } = await req.db
      .from("students")
      .upsert({
        user_id:    userId,
        email:      email.toLowerCase(),
        name:       name || email.split("@")[0],
        role,
        xp:         0,
        title:      "Axiom Scout",
        department: department || null,
        subject:    subject    || null,
      }, { onConflict: "email" });

    if (dbError) {
      logger.error({ err: dbError }, "CreateUser Students insert error");
      // User was created in Auth — partial failure
    }

    return res.status(201).json({
      success: true,
      message: `User ${email} created successfully`,
      userId,
    });
  } catch (err) {
    logger.error({ err: err }, "CreateUser Error");
    return res.status(500).json({ error: "Failed to create user" });
  }
};

/* ═══════════════════════════════════════════
   Shared guard for privileged actions on another user.

   Resolves :userId through the ORG-SCOPED req.db and refuses unless the
   caller strictly outranks the target. Returns the target row on
   success, or null after having already sent the response.

   Both failure modes answer 404, deliberately: an admin probing for the
   super-admin's user id should not be able to tell "exists but you may
   not touch them" from "no such user in your organisation".
═══════════════════════════════════════════ */
async function resolveTarget(req, res, { action }) {
  const { userId }  = req.params;
  const actorId     = req.session?.user?.id;
  const actorRole   = req.session?.user?.role;

  const { data: target, error } = await req.db
    .from("students")
    .select("user_id, email, name, role, org_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.error({ err: error, actorId, userId }, "resolveTarget lookup failed");
    res.status(500).json({ error: "Failed to load user" });
    return null;
  }

  if (!target) {
    res.status(404).json({ error: "User not found" });
    return null;
  }

  if (!outranks(actorRole, target.role)) {
    logger.warn(
      { actorId, actorRole, targetId: userId, targetRole: target.role, action },
      "Refused privileged action: target ranks equal or higher",
    );
    writeAudit({
      actorId,
      actorRole,
      orgId:      req.session?.user?.org_id,
      action:     AuditAction.PRIVILEGE_DENIED,
      targetType: "user",
      targetId:   userId,
      metadata:   { attempted: action, targetRole: target.role },
      req,
    });
    res.status(404).json({ error: "User not found" });
    return null;
  }

  return target;
}

/* ═══════════════════════════════════════════
   USERS — Reset password
   POST /api/admin/users/:userId/reset-password
═══════════════════════════════════════════ */
export const resetUserPassword = async (req, res) => {
  try {
    const { userId }      = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: PASSWORD_TOO_SHORT });
    }

    const target = await resolveTarget(req, res, { action: "reset_password" });
    if (!target) return undefined;

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) return res.status(500).json({ error: error.message });

    writeAudit({
      actorId:    req.session?.user?.id,
      actorRole:  req.session?.user?.role,
      orgId:      req.session?.user?.org_id,
      action:     AuditAction.ADMIN_PASSWORD_RESET,
      targetType: "user",
      targetId:   userId,
      metadata:   { email: target.email, targetRole: target.role },
      req,
    });

    return res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    logger.error({ err }, "resetUserPassword");
    return res.status(500).json({ error: "Failed to reset password" });
  }
};

/* ═══════════════════════════════════════════
   USERS — Update role
   PATCH /api/admin/users/:userId/role
═══════════════════════════════════════════ */
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role }   = req.body;

    if (!["student", "teacher", "admin"].includes(role)) {
      return res.status(400).json({ error: "Role must be 'student', 'teacher' or 'admin'" });
    }

    // Same guard as the other two. Without it an admin could demote a
    // peer admin, which is the same takeover shape as resetting their
    // password. You also cannot grant a rank you do not outrank.
    const target = await resolveTarget(req, res, { action: "update_role" });
    if (!target) return undefined;

    if (!outranks(req.session?.user?.role, role)) {
      return res.status(403).json({ error: "You cannot grant a role equal to or above your own" });
    }

    const { error } = await req.db
      .from("students")
      .update({ role })
      .eq("user_id", userId);

    if (error) return res.status(500).json({ error: error.message });

    writeAudit({
      actorId:    req.session?.user?.id,
      actorRole:  req.session?.user?.role,
      orgId:      req.session?.user?.org_id,
      action:     AuditAction.ROLE_CHANGED,
      targetType: "user",
      targetId:   userId,
      metadata:   { from: target.role, to: role, email: target.email },
      req,
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "updateUserRole");
    return res.status(500).json({ error: "Failed to update role" });
  }
};

/* ═══════════════════════════════════════════
   USERS — Delete user
   DELETE /api/admin/users/:userId
═══════════════════════════════════════════ */
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // The students-row delete below is org-scoped through req.db, but
    // the Auth delete that follows is NOT — so without this guard an
    // admin could destroy an auth account in another organisation while
    // the scoped delete quietly matched nothing.
    const target = await resolveTarget(req, res, { action: "delete_user" });
    if (!target) return undefined;

    // Delete from students table first
    await req.db.from("students").delete().eq("user_id", userId);

    // Delete from Supabase Auth
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) return res.status(500).json({ error: error.message });

    writeAudit({
      actorId:    req.session?.user?.id,
      actorRole:  req.session?.user?.role,
      orgId:      req.session?.user?.org_id,
      action:     AuditAction.USER_DELETED,
      targetType: "user",
      targetId:   userId,
      metadata:   { email: target.email, targetRole: target.role },
      req,
    });

    return res.json({ success: true, message: "User deleted" });
  } catch (err) {
    logger.error({ err }, "deleteUser");
    return res.status(500).json({ error: "Failed to delete user" });
  }
};
