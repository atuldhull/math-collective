import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { superAdmin } from "@/lib/api";
import { PageHeader, SegmentedTabs, TiltPanel } from "@/components/lamp";

const LABEL = "mb-2 block text-[13px] font-medium text-text-muted";
const FIELD = "w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-4 py-2.5 text-sm text-text-primary outline-none transition focus:border-primary/50";

// SaaS pricing model — Super Admin manages these, Orgs (Admins) subscribe
const SAAS_PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthlyUSD: 29,
    yearlyUSD: 290,
    threeYearUSD: 696,
    maxUsers: 100,
    maxChallenges: 200,
    maxEvents: 10,
    features: ["Arena", "Leaderboard", "Events", "Basic Analytics"],
    highlight: false,
  },
  {
    id: "professional",
    name: "Professional",
    monthlyUSD: 79,
    yearlyUSD: 790,
    threeYearUSD: 1896,
    maxUsers: 500,
    maxChallenges: 1000,
    maxEvents: 50,
    features: ["Everything in Starter", "Live Quiz (Socket.IO)", "Certificates", "AI Question Gen", "Projects", "Gallery", "Advanced Analytics"],
    highlight: true,
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyUSD: 199,
    yearlyUSD: 1990,
    threeYearUSD: 4776,
    maxUsers: -1, // unlimited
    maxChallenges: -1,
    maxEvents: -1,
    features: ["Everything in Professional", "Unlimited Users", "Unlimited Content", "Custom Branding", "Priority Support", "API Access", "White-label Option"],
    highlight: false,
  },
];

export default function SAPlansPage() {
  const [dbPlans, setDbPlans] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState("yearly");
  const [msg, setMsg] = useState(null);
  const [assignOrg, setAssignOrg] = useState("");
  const [assignPlan, setAssignPlan] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    Promise.all([
      superAdmin.plans().catch(() => ({ data: [] })),
      superAdmin.orgs().catch(() => ({ data: { data: [] } })),
    ]).then(([p, o]) => {
      setDbPlans(Array.isArray(p.data) ? p.data : []);
      const od = o.data;
      setOrgs(Array.isArray(od) ? od : Array.isArray(od?.data) ? od.data : []);
      setLoading(false);
    });
  }, []);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(null), 4000); };

  const handleAssign = async () => {
    if (!assignOrg || !assignPlan) return;
    setAssigning(true);
    try {
      await superAdmin.assignPlan(assignOrg, assignPlan);
      showMsg("Plan assigned successfully");
      const o = await superAdmin.orgs().catch(() => ({ data: { data: [] } }));
      const od = o.data;
      setOrgs(Array.isArray(od) ? od : Array.isArray(od?.data) ? od.data : []);
    } catch (err) { showMsg(err.response?.data?.error || "Failed to assign"); }
    setAssigning(false);
  };

  const getPrice = (plan) => {
    if (billingCycle === "monthly") return plan.monthlyUSD;
    if (billingCycle === "yearly") return plan.yearlyUSD;
    return plan.threeYearUSD;
  };

  const getPerMonth = (plan) => {
    if (billingCycle === "monthly") return plan.monthlyUSD;
    if (billingCycle === "yearly") return (plan.yearlyUSD / 12).toFixed(0);
    return (plan.threeYearUSD / 36).toFixed(0);
  };

  const getSavings = (plan) => {
    const full = plan.monthlyUSD * (billingCycle === "yearly" ? 12 : billingCycle === "3year" ? 36 : 1);
    const actual = getPrice(plan);
    const saved = full - actual;
    return saved > 0 ? saved : 0;
  };

  if (loading) return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" /></div>;

  const CYCLES = [
    { key: "monthly", label: "Monthly" },
    { key: "yearly", label: "Yearly", badge: "Save 17%" },
    { key: "3year", label: "3 Years", badge: "Save 30%" },
  ];
  const activeCycle = CYCLES.find((c) => c.key === billingCycle);

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Super admin"
        title="Plans and revenue"
        description="Manage SaaS subscription plans for organisations"
      />

      <AnimatePresence>
        {msg && (
          <motion.div key="msg" role="status" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{msg}</motion.div>
        )}
      </AnimatePresence>

      {/* Billing cycle toggle */}
      <div className="mb-8 flex flex-col items-center gap-2">
        <SegmentedTabs
          aria-label="Billing cycle"
          value={billingCycle}
          onChange={setBillingCycle}
          items={CYCLES.map((c) => ({ value: c.key, label: c.label }))}
        />
        <div className="h-6">
          <AnimatePresence mode="wait">
            {activeCycle?.badge && (
              <motion.span
                key={activeCycle.key}
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                className="inline-block rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-[12px] font-medium text-success"
              >
                {activeCycle.badge}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Plan cards */}
      <div data-stagger="tilt" className="grid gap-5 lg:grid-cols-3">
        {SAAS_PLANS.map((plan) => (
          <TiltPanel key={plan.id} lit={plan.highlight} className="relative flex flex-col p-6">
            <div className="relative flex items-center justify-between gap-3">
              <h2 className="text-xl text-text-primary">{plan.name}</h2>
              {plan.popular && (
                <span className="rounded-full bg-primary px-3 py-1 text-[12px] font-medium text-[rgb(var(--color-obsidian))]">
                  Most popular
                </span>
              )}
            </div>

            <div className="relative mt-5">
              <div className="flex items-baseline gap-1">
                <span className="lamp-numerals text-[2.75rem] leading-none text-text-primary">
                  <AnimatedNumber value={Number(getPerMonth(plan))} prefix="$" duration={0.8} />
                </span>
                <span className="text-sm text-text-dim">/mo</span>
              </div>
              <div className="mt-2 min-h-[20px]">
                {billingCycle !== "monthly" && (
                  <p className="text-[13px] text-text-muted">
                    <span className="lamp-numerals">${getPrice(plan)}</span> billed {billingCycle === "yearly" ? "annually" : "every 3 years"}
                    {getSavings(plan) > 0 && <span className="lamp-numerals ml-1.5 text-success">Save ${getSavings(plan)}</span>}
                  </p>
                )}
              </div>
            </div>

            <dl className="relative mt-5 space-y-2 border-t border-[rgb(var(--rule))] pt-5 text-[13px]">
              {[
                ["Users", plan.maxUsers],
                ["Challenges", plan.maxChallenges],
                ["Events", plan.maxEvents],
              ].map(([label, v]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-text-dim">{label}</dt>
                  <dd className="lamp-numerals text-text-primary">{v === -1 ? "Unlimited" : `Up to ${v}`}</dd>
                </div>
              ))}
            </dl>

            <ul className="relative mt-5 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-text-muted">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={1.75} aria-hidden="true" /> {f}
                </li>
              ))}
            </ul>
          </TiltPanel>
        ))}
      </div>

      {/* Assign plan to org */}
      <section data-reveal="up" className="lamp-panel mt-8 p-5 sm:p-6">
        <h2 className="text-lg text-text-primary">Assign a plan to an organisation</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-full min-w-0 sm:min-w-[180px] sm:flex-1">
            <label htmlFor="assign-org" className={LABEL}>Organisation</label>
            <select id="assign-org" value={assignOrg} onChange={(e) => setAssignOrg(e.target.value)} className={FIELD}>
              <option value="">Select org...</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.plan_name || "free"})</option>)}
            </select>
          </div>
          <div className="w-full min-w-0 sm:min-w-[160px] sm:flex-1">
            <label htmlFor="assign-plan" className={LABEL}>Plan</label>
            <select id="assign-plan" value={assignPlan} onChange={(e) => setAssignPlan(e.target.value)} className={FIELD}>
              <option value="">Select plan...</option>
              {dbPlans.map((p) => <option key={p.name} value={p.name}>{p.display_name || p.name} (${p.price_monthly}/mo)</option>)}
              <option value="starter">Starter ($29/mo)</option>
              <option value="professional">Professional ($79/mo)</option>
              <option value="enterprise">Enterprise ($199/mo)</option>
            </select>
          </div>
          <Button size="sm" onClick={handleAssign} loading={assigning} disabled={!assignOrg || !assignPlan} className="w-full sm:w-auto">
            Assign Plan
          </Button>
        </div>
      </section>

      {/* Current org subscriptions */}
      <section data-reveal="up" className="lamp-panel mt-6 p-5 sm:p-6">
        <h2 className="text-lg text-text-primary">Active subscriptions</h2>
        <ul data-stagger="left" className="mt-4 divide-y divide-[rgb(var(--rule))]">
          {orgs.length === 0 && <li className="py-4 text-center text-[13px] text-text-dim">No organisations</li>}
          {orgs.map((org) => (
            <li key={org.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary">{org.name}</p>
                <p className="truncate font-mono text-[12px] text-text-dim">{org.slug}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className={`rounded-full border px-2.5 py-0.5 text-[12px] font-medium capitalize ${
                  org.plan_name === "enterprise" ? "border-secondary/30 bg-secondary/10 text-secondary" :
                  org.plan_name === "professional" ? "border-primary/30 bg-primary/10 text-primary" :
                  "border-[rgb(var(--rule))] bg-white/[0.04] text-text-muted"
                }`}>
                  {org.plan_name || "free"}
                </span>
                <p className="mt-1 text-[12px] text-text-dim">{org.status}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Revenue from DB plans */}
      {dbPlans.length > 0 && (
        <section data-reveal="up" className="lamp-panel mt-6 p-5 sm:p-6">
          <h2 className="text-lg text-text-primary">Plans in the database</h2>
          <p className="mt-1 text-[13px] text-text-muted">The configuration organisations are actually billed against.</p>
          <div className="-mx-5 mt-4 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[rgb(var(--rule))] text-[12px] text-text-dim">
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 text-right font-medium">Monthly</th>
                  <th className="px-3 py-2 text-right font-medium">Yearly</th>
                  <th className="px-3 py-2 text-right font-medium">Users</th>
                  <th className="px-3 py-2 text-right font-medium">Challenges</th>
                  <th className="px-3 py-2 text-right font-medium">Events</th>
                </tr>
              </thead>
              <tbody data-stagger="fade">
                {dbPlans.map((p) => (
                  <tr key={p.name} className="border-b border-[rgb(var(--rule))] last:border-b-0 hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 font-medium text-text-primary">{p.display_name || p.name}</td>
                    <td className="lamp-numerals px-3 py-2.5 text-right text-success">${p.price_monthly || 0}</td>
                    <td className="lamp-numerals px-3 py-2.5 text-right text-success">${p.price_yearly || 0}</td>
                    <td className="lamp-numerals px-3 py-2.5 text-right text-text-muted">{p.max_users || "—"}</td>
                    <td className="lamp-numerals px-3 py-2.5 text-right text-text-muted">{p.max_challenges || "—"}</td>
                    <td className="lamp-numerals px-3 py-2.5 text-right text-text-muted">{p.max_events || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
