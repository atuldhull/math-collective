import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download, KeyRound, Trash2, UserPlus, X } from "lucide-react";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { admin } from "@/lib/api";
import { EmptyState, PageHeader } from "@/components/lamp";

function downloadCsv(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// "New" badge window for the Joined column.
const NEW_MEMBER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const isNewMember = (createdAt) => !!createdAt && Date.now() - new Date(createdAt).getTime() < NEW_MEMBER_WINDOW_MS;
const joinedLabel = (createdAt) =>
  createdAt ? new Date(createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

const icon = (Icon) => <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />;

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState(null);
  const [exporting, setExporting] = useState(false);

  const fetchUsers = (p = 1) => {
    setLoading(true);
    admin.users(p, 20)
      .then((res) => {
        setUsers(res.data?.users || (Array.isArray(res.data) ? res.data : []));
        setTotal(res.data?.total || 0);
        setPage(p);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await admin.createUser(createForm);
      setCreateForm({ name: "", email: "", password: "", role: "student" });
      setShowCreate(false);
      showMsg("User created successfully");
      fetchUsers(page);
    } catch (err) {
      showMsg(err.response?.data?.error || "Failed to create user");
    }
    setCreating(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this user permanently?")) return;
    try {
      await admin.deleteUser(id);
      showMsg("User deleted");
      fetchUsers(page);
    } catch (err) {
      showMsg(err.response?.data?.error || "Failed to delete");
    }
  };

  const handleRoleChange = async (id, role) => {
    try {
      await admin.updateRole(id, role);
      showMsg("Role updated");
      fetchUsers(page);
    } catch (err) {
      showMsg(err.response?.data?.error || "Failed to update role");
    }
  };

  const handleResetPassword = async (id) => {
    const pw = prompt("Enter new password for this user:");
    if (!pw) return;
    try {
      await admin.resetPassword(id, pw);
      showMsg("Password reset successfully");
    } catch (err) {
      showMsg(err.response?.data?.error || "Failed to reset password");
    }
  };

  const handleExportCSV = useCallback(async () => {
    try {
      setExporting(true);
      // The server builds the file from the FULL roster — the list endpoint
      // is capped at 100 per page, which used to truncate this export.
      const res = await admin.exportUsers();
      downloadCsv(res.data, `users_export_${new Date().toISOString().slice(0, 10)}.csv`);
      showMsg("CSV exported — full member list");
    } catch (err) {
      showMsg(err.response?.data?.error || "Failed to export CSV");
    } finally {
      setExporting(false);
    }
  }, []);

  const roleColors = {
    student: "border-secondary/30 bg-secondary/10 text-secondary",
    teacher: "border-success/30 bg-success/10 text-success",
    admin: "border-primary/35 bg-primary/10 text-primary",
    super_admin: "border-danger/30 bg-danger/10 text-danger",
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Admin"
        title="Members"
        description={<><AnimatedNumber value={total} className="lamp-numerals text-text-primary" /> total users. Change roles inline, reset passwords, or export the full roster.</>}
        actions={(
          <>
            <Button variant="secondary" size="sm" loading={exporting} onClick={handleExportCSV} leading={icon(Download)}>
              Export CSV
            </Button>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)} leading={showCreate ? icon(X) : icon(UserPlus)}>
              {showCreate ? "Cancel" : "Create User"}
            </Button>
          </>
        )}
      />

      <AnimatePresence>
        {msg && (
          <motion.div
            key="msg"
            role="status"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
          >
            {msg}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showCreate && (
          <motion.div
            key="create"
            initial={{ opacity: 0, height: 0, rotateX: -10 }}
            animate={{ opacity: 1, height: "auto", rotateX: 0 }}
            exit={{ opacity: 0, height: 0, rotateX: -6 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformPerspective: 900, transformOrigin: "50% 0%" }}
          >
            <form onSubmit={handleCreate} className="lamp-panel lamp-panel--lit mb-6 space-y-4 p-5 sm:p-6">
              <h2 className="text-lg text-text-primary">Create a new user</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField label="Name" placeholder="Full name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                <InputField label="Email" type="email" placeholder="user@university.edu" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField label="Password" type="password" placeholder="Set a password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required />
                <div>
                  <label htmlFor="create-user-role" className="mb-2 block text-[13px] font-medium text-text-muted">Role</label>
                  <select
                    id="create-user-role"
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary/50"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <Button type="submit" loading={creating} size="sm">Create User</Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-12"><Loader variant="orbit" size="lg" /></div>
      ) : users.length === 0 && page <= 1 ? (
        <EmptyState title="No users found" body="Create the first account with the button above, or check back once people register." />
      ) : (
        <section data-reveal="up" className="lamp-panel p-2 md:p-0">
          {/* Below md the table re-flows into stacked cards: each row is a block, each cell carries its own label. */}
          <table className="block w-full text-left text-sm md:table">
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-[rgb(var(--rule))] text-[13px] text-text-muted">
                <th className="px-5 py-3.5 font-medium">User</th>
                <th className="px-4 py-3.5 font-medium">Role</th>
                <th className="px-4 py-3.5 text-right font-medium">XP</th>
                <th className="px-4 py-3.5 font-medium">Status</th>
                <th className="px-4 py-3.5 font-medium">Joined</th>
                <th className="px-5 py-3.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody data-stagger="up" className="block space-y-2 md:table-row-group md:space-y-0">
              {users.length === 0 && (
                <tr className="block md:table-row"><td colSpan="6" className="block px-4 py-8 text-center text-text-dim md:table-cell">No users on this page</td></tr>
              )}
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="grid grid-cols-2 gap-3 rounded-xl border border-[rgb(var(--rule))] bg-white/[0.015] p-4 transition-colors md:table-row md:rounded-none md:border-0 md:border-b md:bg-transparent md:p-0 md:last:border-b-0 md:hover:bg-primary/[0.04]"
                >
                  <td className="col-span-2 min-w-0 md:table-cell md:px-5 md:py-3.5">
                    <p className="font-medium text-text-primary">{u.name || "—"}</p>
                    <p className="break-all font-mono text-[12px] text-text-dim">{u.email}</p>
                  </td>
                  <td className="md:table-cell md:px-4 md:py-3.5">
                    <span className="mb-1 block text-[12px] text-text-dim md:hidden">Role</span>
                    <select
                      aria-label={`Role for ${u.name || u.email}`}
                      value={u.role || "student"}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className={`min-h-[36px] rounded-full border px-3 py-1 text-[12px] font-medium outline-none ${roleColors[u.role] || roleColors.student}`}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="md:table-cell md:px-4 md:py-3.5 md:text-right">
                    <span className="mb-1 block text-[12px] text-text-dim md:hidden">XP</span>
                    <span className="lamp-numerals text-primary">{u.xp || 0}</span>
                  </td>
                  <td className="md:table-cell md:px-4 md:py-3.5">
                    <span className="mb-1 block text-[12px] text-text-dim md:hidden">Status</span>
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${u.is_active !== false ? "bg-success" : "bg-text-dim"}`} />
                      <span className="text-[13px] text-text-muted">{u.is_active !== false ? "active" : "inactive"}</span>
                    </span>
                  </td>
                  <td className="md:table-cell md:px-4 md:py-3.5">
                    <span className="mb-1 block text-[12px] text-text-dim md:hidden">Joined</span>
                    <span className="flex items-center gap-2">
                      <span className="lamp-numerals whitespace-nowrap text-[13px] text-text-muted">{joinedLabel(u.created_at)}</span>
                      {isNewMember(u.created_at) && (
                        <span className="rounded-full border border-success/30 bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">New</span>
                      )}
                    </span>
                  </td>
                  <td className="col-span-2 border-t border-[rgb(var(--rule))] pt-3 md:table-cell md:border-0 md:px-5 md:py-3.5">
                    <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">
                      <Button variant="ghost" size="sm" onClick={() => handleResetPassword(u.id)} leading={icon(KeyRound)}>
                        Reset PW
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(u.id)} leading={icon(Trash2)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-center gap-3 border-t border-[rgb(var(--rule))] px-4 py-3">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => fetchUsers(page - 1)} leading={icon(ChevronLeft)}>Prev</Button>
              <span className="lamp-numerals text-[13px] text-text-muted">Page {page}</span>
              <Button variant="ghost" size="sm" disabled={users.length < 20} onClick={() => fetchUsers(page + 1)} trailing={icon(ChevronRight)}>Next</Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
