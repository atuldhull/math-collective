import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { superAdmin } from "@/lib/api";
import { FEATURE_DEFINITIONS as FEATURES } from "@/config/features";
import { PageHeader } from "@/components/lamp";

const LABEL = "mb-2 block text-[13px] font-medium text-text-muted";
const FIELD = "w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-4 py-3 text-sm text-text-primary outline-none transition focus:border-primary/50";

export default function SAAccessPage() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [flags, setFlags] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Impersonation
  const [impOrg, setImpOrg] = useState("");
  const [impersonating, setImpersonating] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    superAdmin.orgs()
      .then((r) => { const d = r.data; setOrgs(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []); })
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false));
  }, []);

  // When org changes, load its CURRENT flags from the org data
  useEffect(() => {
    if (!selectedOrg) { setFlags({}); return; }
    const org = orgs.find((o) => o.id === selectedOrg);
    if (org && org.feature_flags && typeof org.feature_flags === "object") {
      // Load existing flags, fill missing ones as false
      const loaded = {};
      FEATURES.forEach((f) => { loaded[f.key] = org.feature_flags[f.key] ?? false; });
      setFlags(loaded);
    } else {
      // No flags set yet — default all to false
      const defaults = {};
      FEATURES.forEach((f) => { defaults[f.key] = false; });
      setFlags(defaults);
    }
    setMsg(null);
  }, [selectedOrg, orgs]);

  const toggle = (key) => { setFlags((p) => ({ ...p, [key]: !p[key] })); setMsg(null); };
  const enableAll = () => { const f = {}; FEATURES.forEach((feat) => { f[feat.key] = true; }); setFlags(f); setMsg(null); };
  const disableAll = () => { const f = {}; FEATURES.forEach((feat) => { f[feat.key] = false; }); setFlags(f); setMsg(null); };

  const saveFlags = async () => {
    if (!selectedOrg) return;
    setSaving(true); setMsg(null);
    try {
      await superAdmin.setFeatures(selectedOrg, flags);
      // Refresh orgs to get updated flags
      const r = await superAdmin.orgs();
      const d = r.data;
      setOrgs(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []);
      setMsg({ type: "success", text: "Feature flags saved successfully! Changes are live." });
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.error || "Failed to save" });
    }
    setSaving(false);
  };

  const handleImpersonate = async () => {
    if (!impOrg) return;
    setImpersonating(true);
    try {
      await superAdmin.impersonate(impOrg);
      setIsImpersonating(true);
      setMsg({ type: "success", text: "Impersonation started. You are now acting as this org's admin." });
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.error || "Impersonation failed" });
    }
    setImpersonating(false);
  };

  const stopImpersonate = async () => {
    try {
      await superAdmin.stopImpersonate();
      setIsImpersonating(false);
      setMsg({ type: "success", text: "Impersonation stopped." });
    } catch { /* ignore */ }
  };

  const orgName = orgs.find((o) => o.id === selectedOrg)?.name || "";
  const enabledCount = Object.values(flags).filter(Boolean).length;

  if (loading) return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" /></div>;

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Super admin"
        title="Access control"
        description="Enable or disable features per organisation"
        progress={selectedOrg ? enabledCount / FEATURES.length : undefined}
      />

      <AnimatePresence>
        {msg && (
          <motion.div key={msg.text} role="status" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${msg.type === "success" ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Impersonation banner */}
      <AnimatePresence>
        {isImpersonating && (
          <motion.div
            key="imp"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/35 bg-warning/10 px-4 py-3">
              <p className="flex items-center gap-2 text-sm text-warning">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" /><span className="relative h-2 w-2 rounded-full bg-warning" /></span>
                You are currently impersonating an organisation
              </p>
              <Button size="sm" variant="ghost" onClick={stopImpersonate}>Stop Impersonation</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ FEATURE FLAGS ═══ */}
      <section data-reveal="up" className="lamp-panel lamp-panel--lit p-5 sm:p-6">
        <h2 className="text-xl text-text-primary">Feature flags</h2>
        <p className="mt-1 max-w-[62ch] text-[13px] text-text-muted">Select an organisation, toggle features, and save. Only enabled features will be accessible to that org.</p>

        {/* Org selector */}
        <div className="mt-5">
          <label htmlFor="access-org" className={LABEL}>Organisation</label>
          <select id="access-org" value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)} className={`${FIELD} max-w-md`}>
            <option value="">Choose an organisation...</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>
            ))}
          </select>
        </div>

        {/* Feature toggles */}
        <AnimatePresence mode="wait">
          {selectedOrg && (
            <motion.div key={selectedOrg} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-muted">
                    Managing <span className="font-medium text-text-primary">{orgName}</span>
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full origin-left rounded-full bg-success"
                        initial={false}
                        animate={{ scaleX: FEATURES.length ? enabledCount / FEATURES.length : 0 }}
                        transition={{ type: "spring", stiffness: 160, damping: 22 }}
                      />
                    </div>
                    <span className="lamp-numerals text-[13px] text-text-muted">{enabledCount}/{FEATURES.length} enabled</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={enableAll} className="min-h-[40px] rounded-xl bg-success/10 px-3 text-[13px] font-medium text-success transition hover:bg-success/20">Enable All</button>
                  <button onClick={disableAll} className="min-h-[40px] rounded-xl bg-danger/10 px-3 text-[13px] font-medium text-danger transition hover:bg-danger/20">Disable All</button>
                </div>
              </div>

              <div data-stagger="up" className="grid gap-3 sm:grid-cols-2">
                {FEATURES.map((feat, i) => {
                  const on = !!flags[feat.key];
                  return (
                    <div key={feat.key}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 transition-colors duration-300 ${
                        on ? "border-success/25 bg-success/[0.06]" : "border-[rgb(var(--rule))] bg-white/[0.02]"
                      }`}>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium transition-colors ${on ? "text-text-primary" : "text-text-muted"}`}>{feat.label}</p>
                        <p className="text-[12px] text-text-dim">{feat.description || feat.desc}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`Toggle ${feat.label}`}
                        onClick={() => toggle(feat.key)}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${on ? "bg-success" : "bg-white/10"}`}>
                        {/* Index-based delay makes Enable all / Disable all ripple across the grid. */}
                        <motion.span
                          animate={{ x: on ? 22 : 3 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25, delay: (i % 20) * 0.025 }}
                          className="absolute left-0 top-1 h-5 w-5 rounded-full bg-[rgb(var(--color-text-primary))] shadow"
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button onClick={saveFlags} loading={saving}>
                  Save Feature Flags
                </Button>
                <span className="text-[13px] text-text-dim">Changes apply immediately after saving</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ═══ IMPERSONATION ═══ */}
      <section data-reveal="up" className="lamp-panel mt-6 border-warning/25 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg text-warning">
          <TriangleAlert className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Impersonate an organisation
        </h2>
        <p className="mt-2 max-w-[66ch] text-[13px] leading-6 text-text-muted">
          Impersonation allows you to act as an organisation admin. All actions performed while impersonating will be logged in the audit trail. Use with extreme caution.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-full min-w-0 sm:min-w-[200px] sm:flex-1">
            <label htmlFor="imp-org" className={LABEL}>Organisation</label>
            <select id="imp-org" value={impOrg} onChange={(e) => setImpOrg(e.target.value)} className={FIELD}>
              <option value="">Select org...</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <Button size="sm" variant="danger" onClick={handleImpersonate} loading={impersonating} disabled={!impOrg} className="w-full sm:w-auto">
            Impersonate
          </Button>
        </div>
      </section>
    </div>
  );
}
