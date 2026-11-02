/**
 * IdentityCeremonyModal — first-time identity-forging UX.
 *
 * Flow:
 *   1. User opens chat for the first time → status="missing" →
 *      this modal auto-opens.
 *   2. User clicks "Forge" → store runs startCeremony which
 *      generates a 12-word phrase + derives the keypair.
 *   3. Phrase displayed in a 12-cell grid. User has to toggle a
 *      "I have saved my phrase" checkbox before the confirm
 *      button enables. Friction is deliberate — the phrase is the
 *      one and only way to recover messages.
 *   4. On confirm → store.confirmCeremony uploads the public key
 *      + persists the private scalar to IndexedDB.
 *   5. User sees their freshly-derived sigil animate in.
 */

// @ts-check

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { Check, Copy, KeyRound, X } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { useIsLamplight } from "@/components/lamp/SkinProvider";
import AsymptoteCurve from "@/components/lamp/AsymptoteCurve";
import Loader from "@/components/ui/Loader";
import { motion, AnimatePresence } from "framer-motion";
import { useIdentityStore } from "@/store/identity-store";
import { useUiStore } from "@/store/ui-store";
import IdentityGlyph from "@/components/identity/IdentityGlyph";
import Button from "@/components/ui/Button";

/**
 * @param {{ onRestoreRequest?: () => void }} props
 */
export default function IdentityCeremonyModal({ onRestoreRequest }) {
  const status        = useIdentityStore((s) => s.status);
  const pendingPhrase = useIdentityStore((s) => s.pendingPhrase);
  const sigil         = useIdentityStore((s) => s.sigil);
  const error         = useIdentityStore((s) => s.error);
  const startCeremony   = useIdentityStore((s) => s.startCeremony);
  const confirmCeremony = useIdentityStore((s) => s.confirmCeremony);
  const cancelCeremony  = useIdentityStore((s) => s.cancelCeremony);
  const closeChat       = useUiStore((s) => s.closeChat);
  const lamp            = useIsLamplight();

  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  // "Not now" / ESC / click-outside all do the same thing:
  // reset ceremony state AND close the chat panel. Without closing
  // the panel, the IdentityModalsRoot gate keeps the modal open
  // because status=missing + chatPanelOpen=true still matches its
  // show condition — user would be stuck.
  const dismiss = () => {
    cancelCeremony();
    closeChat();
  };

  // ESC key dismissal.
  useEffect(() => {
    const onKey = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only render when the store is explicitly in a forge-worthy state.
  // `missing` shows the intro, `forging` shows the phrase, `ready`
  // with a fresh sigil shows the celebration frame briefly (we auto-
  // close after a moment).
  const open = status === "missing" || status === "forging";
  if (!open) return null;

  const words = pendingPhrase ? pendingPhrase.split(/\s+/) : [];

  const copy = async () => {
    if (!pendingPhrase) return;
    try {
      await navigator.clipboard.writeText(pendingPhrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  if (lamp) {
    return (
      <LampCeremony
        status={status}
        pendingPhrase={pendingPhrase}
        words={words}
        sigil={sigil}
        error={error}
        startCeremony={startCeremony}
        confirmCeremony={confirmCeremony}
        dismiss={dismiss}
        onRestoreRequest={onRestoreRequest}
        acknowledged={acknowledged}
        setAcknowledged={setAcknowledged}
        copied={copied}
        copy={copy}
      />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9998] flex items-center justify-center overflow-y-auto bg-black/70 backdrop-blur-md px-4 py-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        // Click on the backdrop (anywhere outside the card) dismisses.
        // The card itself stops propagation below.
        onClick={dismiss}
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line/20 bg-panel/95 p-6 shadow-2xl"
        >
          {/* Close X — belts-and-suspenders dismiss path. */}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-lg p-1.5 text-text-dim transition hover:bg-white/5 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* ── Intro — status=missing ── */}
          {status === "missing" && !pendingPhrase && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                Identity Ceremony
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold text-white">
                Forge your mathematical self
              </h2>
              <p className="mt-3 text-sm leading-6 text-text-muted">
                Your chat is end-to-end encrypted. To do that, we need an
                identity key — a piece of math only you hold. We&apos;ll
                generate it from 12 words drawn from the Asymptotes&apos;s
                vocabulary.
              </p>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                You&apos;ll see those 12 words. <strong className="text-white">Save them somewhere safe.</strong>{" "}
                They&apos;re the one and only way to restore your messages on a new
                device. We never see them, and we can&apos;t recover them for you.
              </p>
              {error && (
                <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}
              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="flex gap-3">
                  <Button variant="ghost" size="sm" onClick={dismiss}>
                    Not now
                  </Button>
                  {onRestoreRequest && (
                    <button
                      type="button"
                      onClick={onRestoreRequest}
                      className="font-mono text-[11px] text-secondary hover:underline"
                    >
                      I already have a phrase
                    </button>
                  )}
                </div>
                <Button size="sm" onClick={startCeremony}>
                  Forge my identity
                </Button>
              </div>
            </>
          )}

          {/* ── Forging in progress (PBKDF2 + key derivation ~1-2s) ── */}
          {status === "forging" && !pendingPhrase && (
            <div
              className="flex flex-col items-center justify-center py-12 text-center"
              // Explicit hex colours so the spinner is visible even if
              // the theme tokens (--color-primary) haven't initialised
              // — earlier report was "forge click shows blank" on prod
              // where Tailwind theme vars might race with the mount.
              style={{ minHeight: "200px" }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  border: "3px solid rgb(var(--lamp, 182 160 255) / 0.2)",
                  borderTopColor: "rgb(var(--lamp, 182 160 255))",
                  borderRadius: "50%",
                  animation: "spin 0.9s linear infinite",
                }}
              />
              <p
                className="mt-4 font-mono text-xs uppercase"
                style={{ color: "rgb(var(--lamp))", letterSpacing: "0.3em" }}
              >
                Forging your identity
              </p>
              <p className="mt-2 text-sm" style={{ color: "rgb(var(--color-text-muted))" }}>
                This takes 1–2 seconds on modern hardware.
              </p>
              <p className="mt-1 text-[10px]" style={{ color: "rgb(var(--color-text-dim))" }}>
                Stretching entropy through 100,000 PBKDF2 iterations.
              </p>
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* ── Phrase reveal — status=forging ── */}
          {status === "forging" && pendingPhrase && (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
                Your 12 words
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-white">
                Save these — they are your key
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {words.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-line/15 bg-black/25 px-2 py-2"
                  >
                    <span className="font-mono text-[9px] text-text-dim w-4 text-right">{i + 1}</span>
                    <span className="break-all font-mono text-sm text-white">{w}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={copy}
                  className="font-mono text-[11px] text-primary/80 hover:text-primary"
                >
                  {copied ? "✓ copied" : "Copy to clipboard"}
                </button>
                <p className="font-mono text-[10px] text-text-dim">
                  No digits. No spaces. 12 space-separated words.
                </p>
              </div>

              <label className="mt-6 flex items-start gap-3 cursor-pointer text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-1 accent-primary"
                />
                <span>
                  I have saved my 12 words somewhere safe. I understand that
                  <strong className="text-white"> no one can recover them for me</strong>{" "}
                  — not even the Asymptotes.
                </span>
              </label>

              {error && (
                <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-between gap-3">
                <Button variant="ghost" size="sm" onClick={dismiss}>
                  Cancel
                </Button>
                <Button size="sm" disabled={!acknowledged} onClick={confirmCeremony}>
                  Forge
                </Button>
              </div>
            </>
          )}

          {/* Optional brief celebration when sigil becomes ready from
              ceremony (handled outside this modal's normal open
              condition — UX lives in a separate short-lived toast). */}
          {status === "ready" && sigil && (
            <div className="text-center">
              <IdentityGlyph sigil={sigil} size={96} />
              <p className="mt-3 font-display text-xl text-white">This is you.</p>
            </div>
          )}

          {/* SAFETY NET — if state ever lands outside every branch
              above (previous bug: catch didn't clear pendingPhrase,
              so status=missing+pendingPhrase=truthy matched nothing),
              surface a clear fallback + error instead of an empty
              card. Covers unforeseen state combinations too. */}
          {!(status === "missing" && !pendingPhrase)
            && !(status === "forging" && !pendingPhrase)
            && !(status === "forging" && pendingPhrase)
            && !(status === "ready"   && sigil) && (
            <div className="py-6 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-warning">
                Ceremony needs to restart
              </p>
              <p className="mt-3 text-sm text-text-muted">
                Something went wrong mid-way. Close this window and try again.
              </p>
              {error && (
                <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {error}
                </p>
              )}
              <Button size="sm" variant="ghost" className="mt-4" onClick={dismiss}>
                Close
              </Button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Lamplight ceremony
 * ──────────────────────────────────────────────────────────────────
 * Same states, same store calls. The drama lives in the phrase reveal:
 * the twelve tiles flip up out of the desk one after another, and each
 * word decodes out of random letters before it settles, so the user
 * watches their key being struck. When the sigil arrives it spins in
 * through two expanding lamp rings.
 * ══════════════════════════════════════════════════════════════════ */

const SCRAMBLE = "abcdefghijklmnopqrstuvwxyz";

/**
 * @param {any} props
 */
function LampCeremony({
  status, pendingPhrase, words, sigil, error, startCeremony, confirmCeremony, dismiss,
  onRestoreRequest, acknowledged, setAcknowledged, copied, copy,
}) {
  const cardRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const showIntro   = status === "missing" && !pendingPhrase;
  const showForging = status === "forging" && !pendingPhrase;
  const showPhrase  = status === "forging" && Boolean(pendingPhrase);
  const showReady   = status === "ready" && Boolean(sigil);
  const showFallback = !showIntro && !showForging && !showPhrase && !showReady;

  // Phrase reveal: tiles flip in, words decode. Re-runs per new phrase.
  useGSAP(() => {
    if (!showPhrase || typeof window.matchMedia !== "function") return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tiles = gsap.utils.toArray("[data-tile]", cardRef.current);
      const wordEls = /** @type {HTMLElement[]} */ (gsap.utils.toArray("[data-word]", cardRef.current));
      const tl = gsap.timeline({ delay: 0.15 });
      tl.from("[data-phrase-head] > *", { y: 18, autoAlpha: 0, stagger: 0.08, duration: 0.6, ease: "expo.out" })
        .from(tiles, {
          rotateX: -95,
          y: 14,
          autoAlpha: 0,
          transformOrigin: "50% 100%",
          duration: 0.7,
          ease: "back.out(1.6)",
          stagger: 0.07,
        }, 0.2);
      wordEls.forEach((el, i) => {
        const word = el.dataset.word || "";
        const state = { p: 0 };
        tl.to(state, {
          p: 1,
          duration: 0.65,
          ease: "power1.out",
          onUpdate: () => {
            const shown = Math.floor(state.p * word.length);
            let out = word.slice(0, shown);
            for (let k = shown; k < word.length; k++) out += SCRAMBLE[(Math.random() * 26) | 0];
            el.textContent = out;
          },
          onComplete: () => { el.textContent = word; },
        }, 0.3 + i * 0.07);
      });
      tl.from("[data-phrase-foot]", { y: 12, autoAlpha: 0, duration: 0.5, ease: "expo.out" }, ">-0.2");
      return () => wordEls.forEach((el) => { el.textContent = el.dataset.word || ""; });
    });
    return () => mm.revert();
  }, { scope: cardRef, dependencies: [showPhrase, pendingPhrase], revertOnUpdate: true });

  const errorBox = error ? (
    <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] leading-5 text-danger">
      {error}
    </p>
  ) : null;

  return (
    <motion.div
      className="fixed inset-0 z-[9998] flex items-center justify-center overflow-y-auto bg-[rgb(4_3_10/0.8)] px-3 py-6 backdrop-blur-md sm:px-4"
      style={{ perspective: 1400 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={dismiss}
    >
      <motion.div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Identity ceremony"
        initial={{ y: 40, opacity: 0, rotateX: 14, scale: 0.94 }}
        animate={{ y: 0, opacity: 1, rotateX: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-[1.5rem] border border-[rgb(var(--lamp)/0.28)] bg-[rgb(var(--color-surface)/0.97)] p-6 shadow-[0_50px_140px_-40px_rgb(var(--lamp)/0.45),0_30px_80px_-30px_rgb(0_0_0/0.9)] sm:p-8"
      >
        {/* The lamp, hanging just above the card */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-56 w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--lamp)/0.2),transparent)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 z-[1] grid h-10 w-10 place-items-center rounded-xl text-text-dim transition hover:bg-[rgb(var(--lamp)/0.08)] hover:text-text-primary"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
        </button>

        <AnimatePresence mode="wait" initial={false}>
          {showIntro && (
            <motion.div key="intro" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="relative">
              <AsymptoteCurve className="h-10 w-32" />
              <p className="mt-5 text-[13px] font-medium text-primary">Identity ceremony</p>
              <h2 className="lamp-display mt-1.5 text-[1.75rem] leading-[1.1] text-text-primary sm:text-[2rem]">
                Forge your mathematical self
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-text-muted">
                Your chat is end-to-end encrypted. To do that, we need an
                identity key — a piece of math only you hold. We&apos;ll
                generate it from 12 words drawn from the Asymptotes&apos;s
                vocabulary.
              </p>
              <p className="mt-3 text-[15px] leading-7 text-text-muted">
                You&apos;ll see those 12 words. <strong className="font-semibold text-text-primary">Save them somewhere safe.</strong>{" "}
                They&apos;re the one and only way to restore your messages on a new
                device. We never see them, and we can&apos;t recover them for you.
              </p>
              {errorBox}
              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-between gap-3 sm:justify-start">
                  <Button variant="ghost" size="sm" onClick={dismiss}>
                    Not now
                  </Button>
                  {onRestoreRequest && (
                    <button
                      type="button"
                      onClick={onRestoreRequest}
                      className="min-h-10 rounded-lg px-1 text-[13px] font-medium text-secondary underline-offset-4 hover:underline"
                    >
                      I already have a phrase
                    </button>
                  )}
                </div>
                <Button onClick={startCeremony} leading={<KeyRound className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}>
                  Forge my identity
                </Button>
              </div>
            </motion.div>
          )}

          {showForging && (
            <motion.div
              key="forging"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="relative flex min-h-[220px] flex-col items-center justify-center py-10 text-center"
            >
              <Loader variant="asymptote" size="lg" />
              <p className="lamp-display mt-6 text-xl text-text-primary">Forging your identity</p>
              <p className="mt-2 text-sm text-text-muted">This takes 1–2 seconds on modern hardware.</p>
              <p className="mt-1 text-[12px] text-text-dim">Stretching entropy through 100,000 PBKDF2 iterations.</p>
            </motion.div>
          )}

          {showPhrase && (
            <motion.div key="phrase" exit={{ opacity: 0 }} className="relative">
              <div data-phrase-head>
                <p className="text-[13px] font-medium text-primary">Your 12 words</p>
                <h2 className="lamp-display mt-1.5 text-[1.6rem] leading-[1.15] text-text-primary">
                  Save these. They are your key.
                </h2>
              </div>
              <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3" style={{ perspective: 700 }}>
                {words.map((/** @type {string} */ w, /** @type {number} */ i) => (
                  <li
                    key={i}
                    data-tile
                    className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-[rgb(var(--rule))] bg-[rgb(var(--color-obsidian)/0.55)] px-3 py-2"
                  >
                    <span className="lamp-numerals w-5 shrink-0 text-right text-[12px] text-text-dim">{i + 1}</span>
                    <span data-word={w} className="break-all font-mono text-[14px] text-text-primary">{w}</span>
                  </li>
                ))}
              </ol>

              <div data-phrase-foot>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[rgb(var(--rule))] px-3 text-[13px] font-medium text-text-muted transition hover:border-[rgb(var(--lamp)/0.45)] hover:text-text-primary"
                  >
                    {copied
                      ? <Check className="h-4 w-4 text-success" strokeWidth={2} aria-hidden="true" />
                      : <Copy className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
                    {copied ? "Copied" : "Copy to clipboard"}
                  </button>
                  <p className="text-[12px] text-text-dim">12 words, separated by spaces.</p>
                </div>

                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-[rgb(var(--rule))] p-3.5 text-sm leading-6 text-text-muted transition has-[:checked]:border-[rgb(var(--lamp)/0.45)] has-[:checked]:bg-[rgb(var(--lamp)/0.06)]">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>
                    I have saved my 12 words somewhere safe. I understand that
                    <strong className="font-semibold text-text-primary"> no one can recover them for me</strong>{" "}
                    — not even the Asymptotes.
                  </span>
                </label>

                {errorBox}

                <div className="mt-6 flex items-center justify-between gap-3">
                  <Button variant="ghost" size="sm" onClick={dismiss}>
                    Cancel
                  </Button>
                  <Button disabled={!acknowledged} onClick={confirmCeremony}>
                    Forge
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {showReady && (
            <motion.div key="ready" className="relative flex flex-col items-center py-6 text-center">
              <span className="relative grid h-36 w-36 place-items-center">
                {[0, 1].map((r) => (
                  <motion.span
                    key={r}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full border border-[rgb(var(--lamp)/0.5)]"
                    initial={{ scale: 0.4, opacity: 0.9 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 1.6, delay: 0.25 + r * 0.35, ease: "easeOut" }}
                  />
                ))}
                <motion.span
                  initial={{ scale: 0, rotate: -180, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 160, damping: 14 }}
                >
                  <IdentityGlyph sigil={sigil} size={96} />
                </motion.span>
              </span>
              <motion.p
                className="lamp-display mt-4 text-2xl text-text-primary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                This is you.
              </motion.p>
            </motion.div>
          )}

          {showFallback && (
            <motion.div key="fallback" className="relative py-6 text-center">
              <p className="text-[13px] font-medium text-warning">Ceremony needs to restart</p>
              <p className="mt-3 text-sm text-text-muted">
                Something went wrong mid-way. Close this window and try again.
              </p>
              {errorBox}
              <Button size="sm" variant="ghost" className="mt-5" onClick={dismiss}>
                Close
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
