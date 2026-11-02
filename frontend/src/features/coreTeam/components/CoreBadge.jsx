import { cn } from "@/lib/cn";

/**
 * CoreBadge — the little tier chip worn by every core member.
 *   council (warning), head (secondary), member (primary)
 */
const TIERS = {
  council: { label: "Council", cls: "border-warning/40 bg-warning/12 text-warning" },
  head:    { label: "Head",    cls: "border-secondary/40 bg-secondary/12 text-secondary" },
  member:  { label: "Core",    cls: "border-primary/40 bg-primary/12 text-primary" },
};

export default function CoreBadge({ tier = "member", className }) {
  const t = TIERS[tier] || TIERS.member;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        t.cls,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t.label}
    </span>
  );
}
