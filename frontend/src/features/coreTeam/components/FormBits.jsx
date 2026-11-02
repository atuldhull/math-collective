import { motion } from "framer-motion";
import { X } from "lucide-react";

/** Shared form primitives for the Core Team portal modals & forms. */

export const INPUT_CLS =
  "w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-3.5 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/50 focus:shadow-[0_0_0_4px_rgb(var(--lamp)/0.1)] [color-scheme:dark]";

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Centered, dimmed-backdrop modal. Click-outside and the close button both close.
 *  The sheet tips up out of the page in 3D (rotateX) and settles on a spring. */
export function ModalShell({ title, onClose, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        initial={{ opacity: 0, scale: 0.94, y: 40, rotateX: -14 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 24 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        style={{ transformPerspective: 1100, transformOrigin: "50% 100%" }}
        onClick={(e) => e.stopPropagation()}
        className="lamp-panel lamp-panel--lit max-h-[88vh] w-full max-w-md overflow-y-auto p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-muted transition hover:bg-white/5 hover:text-text-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
