/**
 * SegmentedTabs — a row of choices with a lamp-lit slider underneath.
 *
 * Controlled: pass `value` and `onChange`. Items are `{ value, label,
 * count? }`. The active slider glides between options with a spring
 * (framer layoutId), and the row scrolls horizontally on phones.
 */
import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export default function SegmentedTabs({ items, value, onChange, className, size = "md", "aria-label": ariaLabel }) {
  const layoutId = useId();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "scrollbar-none inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-[rgb(var(--rule))] bg-surface/70 p-1 backdrop-blur-xl",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(item.value)}
            className={cn(
              "relative shrink-0 whitespace-nowrap rounded-xl font-medium transition-colors duration-300",
              size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-4 py-2 text-sm",
              active ? "text-[rgb(var(--color-obsidian))]" : "text-text-muted hover:text-text-primary",
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-primary shadow-[0_6px_24px_-6px_rgb(var(--lamp)/0.6)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative z-[1] inline-flex items-center gap-2">
              {item.label}
              {typeof item.count === "number" ? (
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-black/15" : "bg-white/[0.06] text-text-dim")}>
                  {item.count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
