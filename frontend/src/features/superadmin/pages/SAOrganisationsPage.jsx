import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { BarChart3, PauseCircle, PlayCircle, Plus, Trash2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { superAdmin } from "@/lib/api";
import { EmptyState, PageHeader } from "@/components/lamp";

const LABEL = "mb-2 block text-[13px] font-medium text-text-muted";
const FIELD = "w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/50";

export default function SAOrganisationsPage() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", primary_color: "#7c3aed" });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState(null);
  const [statsId, setStatsId] = useState(null);
  const [statsData, setStatsData] = useState(null);

  const fetchOrgs = () => {
    setLoading(true);
    superAdmin.orgs()
      .then((r) => { const d = r.data; setOrgs(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []); })
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrgs(); }, []);
  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const handleCreate = async (e) => {
    e.preventDefault(); setCreating(true);
    try { await superAdmin.createOrg(form); setForm({ name: "", slug: "", primary_color: "#7c3aed" }); setShowCreate(false); showMsg("Organisation created"); fetchOrgs(); }
    catch (err) { showMsg(err.response?.data?.error || "Failed"); }
    setCreating(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" /></div>;

  const ACT = "inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium transition sm:min-h-[34px]";

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Super admin"
        title="Organisations"
        description={<><AnimatedNumber value={orgs.length} className="lamp-numerals text-text-primary" /> registered. Suspend, reactivate or remove a tenant, or open its numbers.</>}
        actions={(
          <Button size="sm" onClick={() => setShowCreate(!showCreate)} leading={showCreate ? <X className="h-4 w-4" strokeWidth={1.75} /> : <Plus className="h-4 w-4" strokeWidth={1.75} />}>
            {showCreate ? "Cancel" : "Create Organisation"}
          </Button>
        )}
      />

      <AnimatePresence>
        {msg && (
          <motion.div key="msg" role="status" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{msg}</motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showCreate && (
          <motion.div
            key="create"
            initial={{ opacity: 0, height: 0, rotateX: -10 }}
            animate={{ opacity: 1, height: "auto", rotateX: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformPerspective: 900, transformOrigin: "50% 0%" }}
          >
            <form onSubmit={handleCreate} className="lamp-panel lamp-panel--lit mb-6 space-y-4 p-5 sm:p-6">
              <h2 className="text-lg text-text-primary">New organisation</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="org-name" className={LABEL}>Name</label>
                  <input id="org-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })}
                    placeholder="Organisation name" required className={FIELD} />
                </div>
                <div>
                  <label htmlFor="org-slug" className={LABEL}>Slug</label>
                  <input id="org-slug" type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="org-slug" required className={`${FIELD} font-mono`} />
                </div>
              </div>
              <Button type="submit" loading={creating} size="sm">Create</Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {orgs.length === 0 && <EmptyState title="No organisations yet" body="Create the first tenant with the button above." />}
      <ul data-stagger="up" className="space-y-3">
        {orgs.map((org) => (
          <li key={org.id} className="lamp-panel relative overflow-hidden p-4 sm:p-5">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: org.primary_color || "#7c3aed" }} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-[rgb(var(--color-obsidian))]"
                  style={{ background: org.primary_color || "#7c3aed" }}
                >
                  {(org.name || "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">{org.name}</p>
                  <p className="truncate text-[12px] text-text-dim"><span className="font-mono">{org.slug}</span>, <span className="capitalize">{org.plan_name || "free"}</span> plan</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`mr-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${org.status === "active" ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>{org.status}</span>
                <button onClick={async () => { setStatsId(org.id); setStatsData(null); try { const { data } = await superAdmin.orgStats(org.id); setStatsData(data); } catch { setStatsData({ error: true }); } }}
                  className={`${ACT} bg-white/[0.05] text-text-muted hover:text-text-primary`}>
                  <BarChart3 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Stats
                </button>
                {org.status === "active" ? (
                  <button
                    onClick={async () => {
                      if (!confirm("Suspend?")) return;
                      try { await superAdmin.suspendOrg(org.id); showMsg("Suspended"); }
                      catch (err) { showMsg(err.response?.data?.error || "Suspend failed"); return; }
                      fetchOrgs();
                    }}
                    className={`${ACT} bg-warning/10 text-warning hover:bg-warning/15`}>
                    <PauseCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Suspend
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      try { await superAdmin.activateOrg(org.id); showMsg("Activated"); }
                      catch (err) { showMsg(err.response?.data?.error || "Activate failed"); return; }
                      fetchOrgs();
                    }}
                    className={`${ACT} bg-success/10 text-success hover:bg-success/15`}>
                    <PlayCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Activate
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!confirm("DELETE permanently?")) return;
                    try { await superAdmin.deleteOrg(org.id); showMsg("Deleted"); }
                    catch (err) { showMsg(err.response?.data?.error || "Delete failed"); return; }
                    fetchOrgs();
                  }}
                  className={`${ACT} bg-danger/10 text-danger hover:bg-danger/15`}>
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Stats modal */}
      <AnimatePresence>
        {statsId && (
          <motion.div
            key="stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => setStatsId(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="org-stats-title"
              initial={{ scale: 0.9, rotateX: -16, y: 24 }}
              animate={{ scale: 1, rotateX: 0, y: 0 }}
              exit={{ scale: 0.94, y: 12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              style={{ transformPerspective: 1000 }}
              className="lamp-panel lamp-panel--lit max-h-[90vh] w-full max-w-md overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 id="org-stats-title" className="text-xl text-text-primary">Org stats</h3>
                <button onClick={() => setStatsId(null)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl text-text-muted transition hover:bg-white/5 hover:text-text-primary">
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>
              {!statsData ? <div className="py-6"><Loader variant="orbit" size="md" /></div> : statsData.error ? <p className="py-4 text-danger">Failed</p> : (
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  {Object.entries(statsData).filter(([k]) => !["org", "id"].includes(k)).map(([k, v], i) => (
                    <motion.div
                      key={k}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.05 }}
                      className="rounded-xl border border-[rgb(var(--rule))] bg-white/[0.02] px-3 py-2.5"
                    >
                      <dd className="lamp-numerals text-xl text-primary">
                        {typeof v === "number" ? <AnimatedNumber value={v} duration={1} /> : (v ?? 0)}
                      </dd>
                      <dt className="text-[12px] capitalize text-text-muted">{k.replace(/_/g, " ")}</dt>
                    </motion.div>
                  ))}
                </dl>
              )}
              <Button variant="ghost" className="mt-5 w-full" onClick={() => setStatsId(null)}>Close</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
