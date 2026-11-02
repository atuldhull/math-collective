/**
 * StatTile — one number worth looking at.
 *
 * Label above, a count-up value in the display face, and an optional
 * line underneath for context ("+36 this week"). `tone` colours the
 * context line only, so a page of tiles stays calm.
 */
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { cn } from "@/lib/cn";
import TiltPanel from "./TiltPanel";

const TONES = {
  muted: "text-text-dim",
  good: "text-success",
  warn: "text-warning",
  bad: "text-danger",
  lamp: "text-primary",
};

export default function StatTile({ label, value, suffix = "", prefix = "", sub, tone = "muted", icon: Icon, className, lit }) {
  const numeric = typeof value === "number" || value === null || value === undefined;
  return (
    <TiltPanel lit={lit} className={cn("p-5", className)}>
      <div className="relative flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-text-muted">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-text-dim" aria-hidden="true" /> : null}
      </div>
      <p className="lamp-numerals relative mt-2 text-[2rem] leading-none text-text-primary sm:text-[2.25rem]">
        {numeric ? <AnimatedNumber value={value ?? null} prefix={prefix} suffix={suffix} duration={1.4} /> : `${prefix}${value}${suffix}`}
      </p>
      {sub ? <p className={cn("relative mt-2 text-[13px]", TONES[tone] || TONES.muted)}>{sub}</p> : null}
    </TiltPanel>
  );
}
