/**
 * UpgradePrompt — Shown when a feature requires a higher plan.
 *
 * Variants:
 *   - "inline" (default): Small banner within a page
 *   - "fullpage": Takes over the entire content area
 *   - "badge": Tiny lock icon next to a button/nav item
 */

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FEATURES_BY_KEY } from "@/config/features";
import { ArrowUpRight, Lock } from "lucide-react";
import Button from "@/components/ui/Button";
import { useIsLamplight } from "@/components/lamp/SkinProvider";

export default function UpgradePrompt({ featureKey, variant = "inline", currentPlan, className = "" }) {
  const feature = FEATURES_BY_KEY[featureKey];
  const label = feature?.label || featureKey;
  const icon = feature?.icon || "🔒";
  const description = feature?.description || "This feature is not available on your current plan.";

  // Find which plan includes this feature
  const requiredPlan = feature?.plans?.[0] || "professional";
  const lamp = useIsLamplight();
  if (lamp) {
    return <LampUpgrade variant={variant} label={label} description={description} requiredPlan={requiredPlan} currentPlan={currentPlan} className={className} />;
  }

  if (variant === "badge") {
    return (
      <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-warning/10 px-1.5 py-0.5 font-mono text-[8px] uppercase text-warning"
        title={`Requires ${requiredPlan} plan`}>
        🔒 {requiredPlan}
      </span>
    );
  }

  if (variant === "fullpage") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex min-h-[50vh] flex-col items-center justify-center text-center px-4 ${className}`}
      >
        <span className="text-5xl">{icon}</span>
        <h2 className="mt-4 font-display text-2xl font-bold text-white">{label}</h2>
        <p className="mt-2 max-w-md text-sm text-text-muted">{description}</p>
        <div className="mt-3 rounded-full border border-warning/20 bg-warning/8 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-warning">
          Requires {requiredPlan} plan
          {currentPlan && <span className="ml-2 text-text-dim">· Current: {currentPlan}</span>}
        </div>
        <div className="mt-6 flex gap-3">
          <Link to="/billing">
            <Button size="sm">Upgrade Plan</Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">Go Back</Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  // Default: inline banner
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className={`rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-text-dim">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-warning/10 px-2 py-0.5 font-mono text-[8px] uppercase text-warning">
            {requiredPlan}
          </span>
          <Link to="/billing">
            <Button variant="secondary" size="sm">Upgrade</Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

const planName = (p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p);

// Lamplight: a locked door with the lamp behind it. The lock icon swings
// in; the full-page variant gets the asymptote as the "almost there" mark.
function LampUpgrade({ variant, label, description, requiredPlan, currentPlan, className }) {
  if (variant === "badge") {
    return (
      <span
        className="ml-1 inline-flex items-center gap-1 rounded-full border border-[rgb(var(--lamp)/0.3)] bg-[rgb(var(--lamp)/0.1)] px-2 py-0.5 text-[11px] font-medium text-primary"
        title={`Requires ${requiredPlan} plan`}
      >
        <Lock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        {planName(requiredPlan)}
      </span>
    );
  }

  const lockTile = (big) => (
    <motion.span
      initial={{ rotate: -25, scale: 0.6, opacity: 0 }}
      animate={{ rotate: 0, scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
      className={`grid shrink-0 place-items-center rounded-2xl border border-[rgb(var(--lamp)/0.35)] bg-[rgb(var(--lamp)/0.1)] text-primary ${big ? "h-16 w-16" : "h-10 w-10"}`}
    >
      <Lock className={big ? "h-7 w-7" : "h-[18px] w-[18px]"} strokeWidth={1.75} aria-hidden="true" />
    </motion.span>
  );

  if (variant === "fullpage") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`lamp-panel lamp-panel--lit mx-auto flex min-h-[50vh] w-full max-w-xl flex-col items-center justify-center px-6 py-12 text-center ${className}`}
      >
        {lockTile(true)}
        <h2 className="lamp-display mt-5 text-[1.75rem] text-text-primary">{label}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-text-muted">{description}</p>
        <p className="mt-4 text-[13px] text-text-muted">
          Included with the <span className="font-semibold text-primary">{planName(requiredPlan)}</span> plan
          {currentPlan ? <>. You&apos;re on {planName(currentPlan)}.</> : "."}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/billing">
            <Button trailing={<ArrowUpRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}>Upgrade plan</Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="ghost">Go back</Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-[rgb(var(--lamp)/0.25)] bg-[rgb(var(--lamp)/0.06)] p-3.5 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {lockTile(false)}
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm font-semibold text-text-primary">{label}</p>
          <p className="text-[13px] text-text-muted">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-primary">{planName(requiredPlan)}</span>
          <Link to="/billing">
            <Button variant="secondary" size="sm">Upgrade</Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
