import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Lock, LockOpen, Megaphone, RotateCcw, TriangleAlert } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { events as eventsApi, admin } from "@/lib/api";
import { EmptyState, PageHeader, SegmentedTabs } from "@/components/lamp";

const FIELD = "w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/50";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    eventsApi.settings()
      .then((r) => { setSettings(r.data || {}); setLoadError(false); })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const saveSetting = async (key, value) => {
    setSaving(true);
    try {
      await eventsApi.updateSetting(key, value);
      showMsg(`"${key}" updated`);
    } catch (err) {
      showMsg(err.response?.data?.error || "Failed to save");
    }
    setSaving(false);
  };

  const updateAndSave = (key, value) => {
    setSettings({ ...settings, [key]: value });
    saveSetting(key, value);
  };

  const retry = () => { setLoadError(false); setLoading(true); eventsApi.settings().then(r => setSettings(r.data || {})).catch(() => setLoadError(true)).finally(() => setLoading(false)); };

  if (loading) return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" label="Loading settings..." /></div>;
  if (loadError) return (
    <div className="flex flex-col">
      <PageHeader context="Admin" title="Site settings" size="sm" />
      <EmptyState
        title="Couldn't load site settings"
        body="The settings service did not answer. Retry, and if it keeps failing check the server logs."
        action={<Button size="sm" variant="secondary" onClick={retry} leading={<RotateCcw className="h-4 w-4" strokeWidth={1.75} />}>Retry</Button>}
      />
    </div>
  );

  const regOpen = settings.registrations_open === "true";

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Admin"
        title="Site settings"
        description="Who can sign up, what the arena allows, and the notice pinned above every page."
      />

      <AnimatePresence>
        {msg && (
          <motion.div key="msg" role="status" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{msg}</motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Registration Gate — Prominent control */}
        <section data-reveal="tilt" className={`lamp-panel p-5 transition-colors duration-500 sm:p-6 xl:col-span-2 ${regOpen ? "lamp-panel--lit" : "border-danger/25"}`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-colors duration-500 [perspective:400px] ${regOpen ? "bg-success/15 text-success" : "bg-danger/15 text-danger"}`}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={regOpen ? "open" : "closed"}
                    initial={{ rotateY: -90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: 90, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {regOpen
                      ? <LockOpen className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
                      : <Lock className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl text-text-primary">Student registrations</h2>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${
                    regOpen ? "border-success/30 bg-success/15 text-success" : "border-danger/30 bg-danger/15 text-danger"
                  }`}>
                    {regOpen ? "Open" : "Closed"}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-text-muted">
                  {regOpen
                    ? "New students can create accounts right now"
                    : "Registration page shows a \"closed\" message to visitors"}
                </p>
              </div>
            </div>
            <Button
              variant={regOpen ? "danger" : "primary"}
              size="sm"
              loading={saving}
              onClick={() => updateAndSave("registrations_open", regOpen ? "false" : "true")}
            >
              {regOpen ? "Close Registrations" : "Open Registrations"}
            </Button>
          </div>
          {/* Custom closed message */}
          <AnimatePresence initial={false}>
            {!regOpen && (
              <motion.div key="closed-msg" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-5 border-t border-[rgb(var(--rule))] pt-4">
                  <label htmlFor="reg-message" className="block text-[13px] font-medium text-text-muted">Closed message <span className="text-text-dim">(shown to visitors)</span></label>
                  <textarea
                    id="reg-message"
                    value={settings.registration_message || ""}
                    onChange={(e) => setSettings({ ...settings, registration_message: e.target.value })}
                    placeholder="Registrations are currently closed. Check back soon!"
                    rows={2}
                    className={`mt-2 ${FIELD}`}
                  />
                  <Button size="sm" variant="ghost" className="mt-2" loading={saving}
                    onClick={() => saveSetting("registration_message", settings.registration_message || "")}>
                    Save Message
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Other Site Controls */}
        <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
          <h2 className="text-lg text-text-primary">Site controls</h2>
          <div className="mt-4 divide-y divide-[rgb(var(--rule))]">
            {[
              { key: "arena_open", label: "Arena Open", desc: "Allow students to access challenges and submit answers" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm text-text-primary">{item.label}</p>
                  <p className="text-[13px] text-text-muted">{item.desc}</p>
                </div>
                <Switch
                  on={settings[item.key] === "true"}
                  disabled={saving}
                  label={`Toggle ${item.label}`}
                  onClick={() => updateAndSave(item.key, settings[item.key] === "true" ? "false" : "true")}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Announcement Banner */}
        <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-lg text-text-primary">
                <Megaphone className="h-4 w-4 text-secondary" strokeWidth={1.75} aria-hidden="true" />
                Announcement banner
              </h2>
              <p className="mt-1 text-[13px] text-text-muted">
                {settings.banner_enabled === "true"
                  ? "Live — pinned to the top of every page"
                  : "Off — turn on to pin the message to the top of every page"}
              </p>
            </div>
            <Switch
              on={settings.banner_enabled === "true"}
              disabled={saving}
              label="Toggle announcement banner"
              onClick={() => updateAndSave("banner_enabled", settings.banner_enabled === "true" ? "false" : "true")}
            />
          </div>
          <textarea
            aria-label="Announcement text"
            value={settings.site_notice || ""}
            onChange={(e) => setSettings({ ...settings, site_notice: e.target.value })}
            placeholder="Registrations are open — join the Collective!"
            rows={3}
            className={`mt-4 ${FIELD}`}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <SegmentedTabs
                size="sm"
                aria-label="Banner audience"
                value={settings.banner_audience === "all" ? "all" : "guests"}
                onChange={(v) => { if (!saving) updateAndSave("banner_audience", v); }}
                items={[
                  { value: "guests", label: "New visitors" },
                  { value: "all", label: "Everyone" },
                ]}
              />
              <SegmentedTabs
                size="sm"
                aria-label="Banner style"
                value={settings.banner_style === "ticker" ? "ticker" : "static"}
                onChange={(v) => { if (!saving) updateAndSave("banner_style", v); }}
                items={[
                  { value: "ticker", label: "Ticker" },
                  { value: "static", label: "Static" },
                ]}
              />
            </div>
            <Button size="sm" onClick={() => saveSetting("site_notice", settings.site_notice || "")} loading={saving}>
              Update Notice
            </Button>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-text-dim">
            &ldquo;New visitors&rdquo; shows the banner (with a Join CTA) only to people who aren&apos;t signed in.
            &ldquo;Ticker&rdquo; scrolls the message like running news.
          </p>
        </section>

        {/* Platform Info */}
        <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
          <h2 className="text-lg text-text-primary">Current values</h2>
          <dl data-stagger="fade" className="mt-4 divide-y divide-[rgb(var(--rule))]">
            {Object.entries(settings).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-4 py-2">
                <dt className="min-w-0 truncate font-mono text-[12px] text-text-dim">{key}</dt>
                <dd className={`min-w-0 truncate text-right font-mono text-[12px] ${value === "true" ? "text-success" : value === "false" ? "text-danger" : "text-text-primary"}`}>
                  {String(value) || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Danger Zone */}
        <section data-reveal="up" className="lamp-panel border-danger/25 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg text-danger">
            <TriangleAlert className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            Danger zone
          </h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-[rgb(var(--rule))] bg-white/[0.02] px-4 py-3">
              <p className="text-sm text-text-primary">Weekly leaderboard reset</p>
              <p className="text-[13px] text-text-muted">Archive current standings, record winner, start fresh week</p>
              <Button size="sm" variant="danger" className="mt-3" onClick={async () => {
                if (!confirm("Reset weekly leaderboard? This archives current standings.")) return;
                try { const { data } = await admin.resetWeek(); showMsg(data.message || "Reset complete"); } catch { showMsg("Reset failed"); }
              }}>
                Trigger Reset
              </Button>
            </div>
            <div className="rounded-xl border border-danger/25 bg-danger/[0.06] px-4 py-3">
              <p className="text-sm text-text-primary">Clear all attempts</p>
              <p className="text-[13px] text-danger/80">Permanently delete every submission. Cannot be undone.</p>
              <Button size="sm" variant="danger" className="mt-3" onClick={async () => {
                if (!confirm("Delete ALL attempts for ALL users? This CANNOT be undone.")) return;
                if (!confirm("Are you absolutely sure?")) return;
                try { await admin.clearAllAttempts(); showMsg("All attempts cleared"); } catch { showMsg("Failed"); }
              }}>
                Clear Everything
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** A spring-knob switch; the knob slides with a framer layout transition. */
function Switch({ on, onClick, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors duration-300 disabled:opacity-60 ${on ? "justify-end bg-primary shadow-[0_0_18px_-4px_rgb(var(--lamp)/0.7)]" : "justify-start bg-white/10"}`}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 520, damping: 32 }} className="h-5 w-5 rounded-full bg-[rgb(var(--color-text-primary))] shadow" />
    </button>
  );
}
