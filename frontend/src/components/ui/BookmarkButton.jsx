/**
 * BookmarkButton — universal "save for later" toggle.
 *
 * Drops onto any card / detail page. Pass `type` ("problem" | "writeup"
 * | "roadmap"), `id`, and an optional `initial` flag (from a parent's
 * bulk state fetch — see bookmarks.state). The button manages its own
 * optimistic state from there.
 *
 * Renders as a small star button. `compact` shrinks it to fit on
 * tightly-packed list-card corners; `withLabel` shows "Save" /
 * "Saved" text next to it for the detail-page surface.
 *
 * The click handler stopPropagation()s — these buttons live inside
 * <Link> cards and we don't want a click to bookmark AND navigate.
 */

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bookmark } from "lucide-react";
import { bookmarks } from "@/lib/api";
import { useIsLamplight } from "@/components/lamp/SkinProvider";

export default function BookmarkButton({
  type,
  id,
  initial = false,
  compact = false,
  withLabel = false,
  onToggle,
}) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy]   = useState(false);
  const lamp = useIsLamplight();

  // If the parent re-reads `initial` (e.g. after a route change),
  // re-sync. Avoids stale "Saved" when the parent's bulk-fetch lands
  // late.
  useEffect(() => { setSaved(initial); }, [initial]);

  const onClick = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !saved;
    setSaved(next);                       // optimistic
    setBusy(true);
    try {
      const { data } = await bookmarks.toggle(type, id);
      setSaved(Boolean(data.saved));
      if (onToggle) onToggle(Boolean(data.saved));
    } catch {
      setSaved(!next);                    // roll back
    } finally {
      setBusy(false);
    }
  }, [busy, saved, type, id, onToggle]);

  // Mobile gets a slightly bigger compact target (32px vs 28px) so a
  // thumb-tap on a list card's star button is accurate. Desktop keeps
  // the tighter shape so the star doesn't dominate the card corner.
  const sizes = compact
    ? "h-8 w-8 text-base sm:h-7 sm:w-7 sm:text-sm"
    : "h-10 px-3 text-base sm:h-9 sm:px-2.5";

  if (lamp) {
    // Lamplight: a bookmark ribbon that fills with the accent and pops when saved.
    return (
      <motion.button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved" : "Save for later"}
        title={saved ? "Saved" : "Save for later"}
        whileTap={{ scale: 0.88 }}
        className={
          "inline-flex shrink-0 items-center justify-center gap-1.5 border transition-colors duration-300 " +
          (compact ? "h-10 w-10 rounded-xl sm:h-8 sm:w-8 sm:rounded-lg " : "h-10 rounded-xl px-3 text-[13px] font-medium ") +
          (saved
            ? "border-[rgb(var(--lamp)/0.45)] bg-[rgb(var(--lamp)/0.12)] text-primary"
            : "border-[rgb(var(--rule))] bg-surface/60 text-text-muted hover:border-[rgb(var(--lamp)/0.4)] hover:text-text-primary")
        }
      >
        <motion.span
          key={saved ? "on" : "off"}
          initial={saved ? { scale: 0.4, rotate: -20 } : false}
          animate={{ scale: [null, 1.25, 1], rotate: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="grid place-items-center"
          aria-hidden="true"
        >
          <Bookmark className={compact ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
        </motion.span>
        {withLabel && <span>{saved ? "Saved" : "Save"}</span>}
      </motion.button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save for later"}
      title={saved ? "Saved" : "Save for later"}
      className={
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border transition " +
        sizes + " " +
        (saved
          ? "border-warning/40 bg-warning/12 text-warning hover:bg-warning/20"
          : "border-line/20 bg-white/[0.04] text-text-muted hover:border-warning/40 hover:text-warning")
      }
    >
      <span aria-hidden="true">{saved ? "★" : "☆"}</span>
      {withLabel && (
        <span className="font-mono text-[11px] uppercase tracking-wider">{saved ? "Saved" : "Save"}</span>
      )}
    </button>
  );
}
