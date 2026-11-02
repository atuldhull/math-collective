import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Archive, CalendarRange, Eraser, RotateCcw, Trash2, Users } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { admin } from "@/lib/api";
import { PageHeader, StatTile } from "@/components/lamp";

const icon = (Icon) => <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />;
const rowMotion = {
  initial: false,
  exit: { opacity: 0, x: 40, height: 0, marginTop: 0, transition: { duration: 0.3 } },
};

export default function AdminDataPage() {
  const [teams, setTeams] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [userId, setUserId] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      admin.teams().catch(() => ({ data: [] })),
      admin.tests().catch(() => ({ data: [] })),
    ]).then(([t, te]) => {
      setTeams(Array.isArray(t.data) ? t.data : []);
      setTests(Array.isArray(te.data) ? te.data : []);
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, []);
  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  if (loading) return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" /></div>;

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Admin"
        title="Data and teams"
        description="Clean up one member's record, remove stale teams and tests, or take a full backup."
        actions={(
          <Button
            size="sm"
            variant="secondary"
            loading={exporting}
            leading={icon(Archive)}
            onClick={async () => {
              setExporting(true);
              try {
                const res = await admin.exportAll();
                const blob = new Blob([res.data], { type: "application/zip" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `asymptotes-export-${new Date().toISOString().slice(0,10)}.zip`;
                a.click();
                URL.revokeObjectURL(url);
                showMsg("Export downloaded!");
              } catch (err) {
                showMsg("Export failed: " + (err.response?.data?.error || err.message));
              }
              setExporting(false);
            }}
          >
            Export All Data (ZIP)
          </Button>
        )}
      />

      <AnimatePresence>
        {msg && (
          <motion.div key="msg" role="status" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{msg}</motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* User operations */}
        <section data-reveal="tilt" className="lamp-panel lamp-panel--lit p-5 sm:p-6">
          <h2 className="text-lg text-text-primary">One member&apos;s record</h2>
          <p className="mt-1 text-[13px] text-text-muted">Clear attempts or reset XP for a specific user</p>
          <div className="mt-5 space-y-3">
            <label htmlFor="data-user-id" className="block text-[13px] font-medium text-text-muted">User ID</label>
            <input id="data-user-id" type="text" placeholder="Enter User ID" value={userId} onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-4 py-3 font-mono text-sm text-text-primary outline-none transition placeholder:font-sans placeholder:text-text-dim focus:border-primary/50" />
            <div className="flex flex-wrap gap-3">
              <Button size="sm" variant="ghost" disabled={!userId} leading={icon(Eraser)} onClick={async () => {
                if (!confirm("Clear all attempts for this user?")) return;
                try { await admin.clearAttempts(userId); showMsg("Attempts cleared"); }
                catch (err) { showMsg(err.response?.data?.error || "Failed to clear attempts"); }
              }}>Clear Attempts</Button>
              <Button size="sm" variant="ghost" disabled={!userId} leading={icon(RotateCcw)} onClick={async () => {
                if (!confirm("Reset XP to 0?")) return;
                try { await admin.resetXp(userId); showMsg("XP reset to 0"); }
                catch (err) { showMsg(err.response?.data?.error || "Failed to reset XP"); }
              }}>Reset XP</Button>
            </div>
          </div>
        </section>

        {/* Summary */}
        <div data-stagger="scale" className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatTile label="Teams" value={teams.length} icon={Users} />
          <StatTile label="Scheduled tests" value={tests.length} icon={CalendarRange} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {/* Teams */}
        <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
          <h2 className="text-lg text-text-primary">Teams <span className="lamp-numerals text-text-dim">{teams.length}</span></h2>
          <ul data-stagger="left" className="mt-4 space-y-2">
            {teams.length === 0 && <li className="py-4 text-center text-[13px] text-text-dim">No teams created</li>}
            <AnimatePresence initial={false}>
              {teams.map((t) => (
                <motion.li key={t.id} {...rowMotion} className="flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-[rgb(var(--rule))] bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">{t.name}</p>
                    <p className="truncate text-[12px] text-text-dim">
                      <span className="lamp-numerals">{t.members?.length || 0}</span> members{t.project_title ? `, ${t.project_title}` : ""}
                    </p>
                  </div>
                  <Button variant="danger" size="sm" leading={icon(Trash2)} onClick={async () => {
                    if (!confirm("Delete this team?")) return;
                    try { await admin.deleteTeam(t.id); showMsg("Team deleted"); fetchData(); }
                    catch (err) { showMsg(err.response?.data?.error || "Delete failed"); }
                  }}>Delete</Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>

        {/* Tests */}
        <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
          <h2 className="text-lg text-text-primary">Scheduled tests <span className="lamp-numerals text-text-dim">{tests.length}</span></h2>
          <ul data-stagger="left" className="mt-4 space-y-2">
            {tests.length === 0 && <li className="py-4 text-center text-[13px] text-text-dim">No tests scheduled</li>}
            <AnimatePresence initial={false}>
              {tests.map((t) => (
                <motion.li key={t.id} {...rowMotion} className="flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-[rgb(var(--rule))] bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-primary">{t.title}</p>
                    <p className="lamp-numerals text-[12px] text-text-dim">
                      {t.starts_at ? new Date(t.starts_at).toLocaleString() : ""} to {t.ends_at ? new Date(t.ends_at).toLocaleString() : ""}
                    </p>
                  </div>
                  <Button variant="danger" size="sm" leading={icon(Trash2)} onClick={async () => {
                    if (!confirm("Delete this test?")) return;
                    try { await admin.deleteTest(t.id); showMsg("Test deleted"); fetchData(); }
                    catch (err) { showMsg(err.response?.data?.error || "Delete failed"); }
                  }}>Delete</Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      </div>
    </div>
  );
}
