/**
 * RestoreIdentityModal — paste-your-phrase flow for users who
 * cleared their browser / switched devices.
 *
 * Opens from the ceremony modal's "I already have a phrase" link
 * (or from a future "Settings → Restore" button).
 */

// @ts-check

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIdentityStore } from "@/store/identity-store";
import { isWordInWordlist } from "@/lib/identity/mnemonic";
import Button from "@/components/ui/Button";
import { useIsLamplight } from "@/components/lamp/SkinProvider";
import { cn } from "@/lib/cn";

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function RestoreIdentityModal({ open, onClose }) {
  const restoreFromPhrase = useIdentityStore((s) => s.restoreFromPhrase);
  const status = useIdentityStore((s) => s.status);
  const error = useIdentityStore((s) => s.error);
  const clearError = useIdentityStore((s) => s.clearError);

  const [text, setText] = useState("");
  const lamp = useIsLamplight();
  /** @param {string} a @param {string} b */
  const t = (a, b) => (lamp ? a : b);

  if (!open) return null;

  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const unknownWord = words.find((w) => !isWordInWordlist(w));
  const wrongCount = words.length !== 12 && words.length > 0;

  const busy = status === "restoring";

  const handleRestore = async () => {
    clearError();
    await restoreFromPhrase(text);
    // If successful the store flips to "ready" and parent can close
    // on next render; if there was an error, status flipped back to
    // "missing" and the error prop renders in the modal.
    if (useIdentityStore.getState().status === "ready") {
      setText("");
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className={t("fixed inset-0 z-[9998] flex items-center justify-center overflow-y-auto bg-[rgb(4_3_10/0.8)] px-3 py-6 backdrop-blur-md sm:px-4", "fixed inset-0 z-[9998] flex items-center justify-center overflow-y-auto bg-black/70 backdrop-blur-md px-4 py-6")}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          initial={lamp ? { y: 30, opacity: 0, scale: 0.95 } : { y: 20, opacity: 0 }}
          animate={lamp ? { y: 0, opacity: 1, scale: 1 } : { y: 0, opacity: 1 }}
          transition={lamp ? { type: "spring", stiffness: 260, damping: 26 } : undefined}
          role={lamp ? "dialog" : undefined}
          aria-modal={lamp ? "true" : undefined}
          aria-label={lamp ? "Restore identity" : undefined}
          className={t("relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[1.5rem] border border-[rgb(var(--violet)/0.35)] bg-[rgb(var(--color-surface)/0.97)] p-6 shadow-[0_40px_120px_-40px_rgb(var(--violet)/0.5)] sm:p-7", "max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line/20 bg-panel/95 p-6 shadow-2xl")}
        >
          <p className={t("text-[13px] font-medium text-secondary", "font-mono text-[10px] uppercase tracking-[0.3em] text-secondary")}>
            Restore identity
          </p>
          <h2 className={t("lamp-display mt-1.5 text-[1.6rem] leading-tight text-text-primary", "mt-2 font-display text-xl font-bold text-white")}>
            Paste your 12 words
          </h2>
          <p className={t("mt-2 text-sm text-text-muted", "mt-2 text-xs text-text-dim")}>
            Separated by single spaces. Capitalisation doesn&apos;t matter.
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
            rows={3}
            aria-label={lamp ? "Your 12 words" : undefined}
            className={t("mt-4 w-full resize-none rounded-xl border border-[rgb(var(--rule))] bg-[rgb(var(--color-obsidian)/0.6)] px-4 py-3 font-mono text-sm leading-6 text-text-primary outline-none transition placeholder:text-text-dim focus:border-[rgb(var(--violet)/0.6)] focus:shadow-[0_0_0_3px_rgb(var(--violet)/0.15)]", "mt-4 w-full resize-none rounded-xl border border-line/15 bg-black/25 px-4 py-3 font-mono text-sm text-white outline-none focus:border-primary/40")}
            disabled={busy}
            autoFocus
          />

          {/* Live validation hints */}
          <div className={t("mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px]", "mt-2 flex items-center justify-between font-mono text-[10px]")}>
            {lamp ? (
              <span className="flex items-center gap-2">
                <span className="flex gap-0.5" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1.5 w-2.5 rounded-full transition-colors duration-300",
                        i < words.length ? (wrongCount && words.length > 12 ? "bg-warning" : "bg-secondary") : "bg-[rgb(var(--rule))]",
                      )}
                    />
                  ))}
                </span>
                <span className={cn("lamp-numerals", wrongCount ? "text-warning" : "text-text-dim")}>
                  {words.length} / 12 words
                </span>
              </span>
            ) : (
            <span className={wrongCount ? "text-warning" : "text-text-dim"}>
              {words.length} / 12 words
            </span>
            )}
            {unknownWord && (
              <span className="text-danger">
                &ldquo;{unknownWord}&rdquo; is not in the wordlist
              </span>
            )}
          </div>

          {error && (
            <p className={t("mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger", "mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger")}>
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRestore}
              loading={busy}
              disabled={words.length !== 12 || !!unknownWord}
            >
              Restore
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
