/**
 * AdminFeaturesPage — Org admin feature management dashboard.
 *
 * Shows:
 *   - Current plan name + limits
 *   - All features grouped by category
 *   - Toggle ON/OFF for features included in plan
 *   - Lock icon + upgrade prompt for features NOT in plan
 *   - Usage stats vs plan limits
 */

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award, BarChart3, Bell, Bot, CalendarDays, Calculator, Gift, Hammer, Images, Link2, Lock, MessagesSquare,
  Package, Palette, QrCode, ScrollText, Trophy, TrendingUp, Zap, Sparkles,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { orgAdmin } from "@/lib/api";
import { FEATURE_DEFINITIONS, FEATURE_CATEGORIES, FEATURES_BY_KEY } from "@/config/features";
import { EmptyState, PageHeader, StatTile } from "@/components/lamp";

// Line icons for each feature key (the config ships emoji, which the skin avoids).
const FEATURE_ICONS = {
  arena: Calculator, leaderboard: Trophy, events: CalendarDays, notifications: Bell, ai_tools: Bot,
  certificates: ScrollText, quiz: Zap, projects: Hammer, gallery: Images, achievements: Award,
  qr_checkin: QrCode, event_leaderboard: BarChart3, messaging: MessagesSquare, referrals: Gift,
  analytics: TrendingUp, custom_branding: Palette, data_export: Package, api_access: Link2,
};

export default function AdminFeaturesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [msg, setMsg] = useState(null);

  const fetchFeatures = async () => {
    try {
      setLoading(true);
      const res = await orgAdmin.features();
      setData(res.data);
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchFeatures(); }, []);

  const handleToggle = async (featureKey, currentEnabled) => {
    setToggling(featureKey);
    try {
      await orgAdmin.toggleFeature(featureKey, !currentEnabled);
      setMsg(`${FEATURES_BY_KEY[featureKey]?.label || featureKey} ${!currentEnabled ? "enabled" : "disabled"}`);
      setTimeout(() => setMsg(null), 3000);
      fetchFeatures();
    } catch (err) {
      const errMsg = err.response?.data?.error || "Failed";
      setMsg(errMsg);
      setTimeout(() => setMsg(null), 4000);
    }
    setToggling(null);
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" label="Loading features..." /></div>;
  }

  if (!data) {
    return (
      <div className="flex flex-col">
        <PageHeader context="Admin" title="Features" size="sm" />
        <EmptyState
          title="Failed to load feature configuration"
          body="The organisation service did not answer. Refresh the page to try again."
          action={<Button size="sm" variant="secondary" onClick={fetchFeatures}>Try again</Button>}
        />
      </div>
    );
  }

  const planName = data.plan_name || "starter";
  const planDisplay = data.plan_display || planName;
  const limits = data.plan_limits || {};
  const features = data.features || {};
  const limitValue = (v) => (v === -1 ? "Unlimited" : v);

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Admin"
        title="Features"
        description="Toggle features for your organisation"
        actions={(
          <>
            <span className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-4 text-[13px] font-medium text-primary">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              <span className="capitalize">{planDisplay}</span> plan
            </span>
            <Link to="/billing">
              <Button variant="secondary" size="sm">Upgrade</Button>
            </Link>
          </>
        )}
      />

      {/* Plan Limits */}
      <div data-stagger="scale" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Max users" value={limitValue(limits.max_users)} lit />
        <StatTile label="Max challenges" value={limitValue(limits.max_challenges)} />
        <StatTile label="Max events" value={limitValue(limits.max_events)} className="col-span-2 sm:col-span-1" />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {msg && (
          <motion.div key="msg" role="status" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mt-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{msg}</motion.div>
        )}
      </AnimatePresence>

      {/* Feature Grid by Category */}
      <div className="mt-8 space-y-8">
        {FEATURE_CATEGORIES.map(category => {
          const categoryFeatures = FEATURE_DEFINITIONS.filter(f => f.category === category);
          const onCount = categoryFeatures.filter(f => {
            const st = features[f.key];
            return st ? st.effective : f.plans.includes(planName);
          }).length;
          return (
            <section key={category} data-reveal="up">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-lg text-text-primary">{category}</h2>
                <p className="text-[13px] text-text-dim"><span className="lamp-numerals text-text-muted">{onCount}</span> of <span className="lamp-numerals">{categoryFeatures.length}</span> on</p>
              </div>
              <div data-stagger="tilt" className="grid gap-3 md:grid-cols-2">
                {categoryFeatures.map(featureDef => {
                  const key = featureDef.key;
                  const featureState = features[key];
                  const inPlan = featureDef.plans.includes(planName);
                  const isEnabled = featureState ? featureState.effective : inPlan;
                  const isToggling = toggling === key;
                  const Icon = FEATURE_ICONS[key] || Sparkles;

                  return (
                    <div key={key} className={`lamp-panel flex items-center justify-between gap-4 px-4 py-3.5 transition-colors duration-300 ${
                      !inPlan ? "border-dashed opacity-80" : isEnabled ? "border-success/25" : ""
                    }`}>
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
                          inPlan && isEnabled ? "bg-primary/12 text-primary" : "bg-white/[0.04] text-text-dim"
                        }`}>
                          <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-text-primary">{featureDef.label}</p>
                            {!inPlan && (
                              <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                                Upgrade required
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[12px] text-text-muted">{featureDef.description}</p>
                        </div>
                      </div>

                      {/* Toggle or Lock */}
                      {inPlan ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isEnabled}
                          aria-label={`Toggle ${featureDef.label}`}
                          onClick={() => handleToggle(key, isEnabled)}
                          disabled={isToggling}
                          className={`relative flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors duration-300 disabled:opacity-60 ${
                            isEnabled ? "justify-end bg-success/40" : "justify-start bg-white/10"
                          }`}
                        >
                          <motion.span
                            layout
                            transition={{ type: "spring", stiffness: 520, damping: 32 }}
                            className={`h-5 w-5 rounded-full shadow ${isEnabled ? "bg-success" : "bg-[rgb(var(--color-text-muted))]"}`}
                          />
                        </button>
                      ) : (
                        <Link to="/billing" className="group flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg px-2 text-[13px] text-warning hover:bg-warning/10">
                          <motion.span whileHover={{ rotate: [0, -12, 10, -6, 0] }} transition={{ duration: 0.5 }} className="inline-flex">
                            <Lock className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </motion.span>
                          Upgrade
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
