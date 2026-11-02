/**
 * EmptyState — an empty list as an invitation to act.
 * Title says what's missing, body says what to do, `action` does it.
 */
import { cn } from "@/lib/cn";
import AsymptoteCurve from "./AsymptoteCurve";

export default function EmptyState({ title, body, action, className, compact = false }) {
  return (
    <div
      data-reveal="scale"
      className={cn(
        "lamp-panel flex flex-col items-center justify-center text-center",
        compact ? "gap-3 px-6 py-10" : "gap-4 px-6 py-16",
        className,
      )}
    >
      <AsymptoteCurve className="h-12 w-40 opacity-80" />
      <p className="lamp-display text-xl text-text-primary sm:text-2xl">{title}</p>
      {body ? <p className="max-w-[46ch] text-sm leading-6 text-text-muted">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
