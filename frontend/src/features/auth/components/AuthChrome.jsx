/**
 * Shared Lamplight pieces for the auth forms: the heading every form
 * opens with, the notice banner (errors, confirmations), and the
 * password meter that fills along an asymptote as a password gets
 * stronger.
 *
 * All presentation. None of these own state that the forms depend on.
 */
import { useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";

/* ── Heading ─────────────────────────────────────────────────────── */
export function AuthHeading({ icon: Icon, kicker, title, children, tone = "lamp" }) {
  const root = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.25 })
        .from(q("[data-chip]"), { scale: 0.4, rotate: -40, autoAlpha: 0, duration: 0.9, ease: "back.out(2)" })
        .from(q("[data-kicker]"), { x: -14, autoAlpha: 0, duration: 0.7 }, "<0.1")
        .from(q(".lamp-word > span"), { yPercent: 115, duration: 1, stagger: 0.06 }, "<0.05")
        .from(q("[data-body]"), { y: 10, autoAlpha: 0, duration: 0.8 }, "<0.3");
    });
    return () => mm.revert();
  }, { scope: root });

  const chipTone = tone === "violet"
    ? "border-secondary/30 bg-secondary/12 text-secondary"
    : tone === "good"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "bad"
        ? "border-danger/30 bg-danger/10 text-danger"
        : "border-primary/30 bg-primary/10 text-primary";

  return (
    <div ref={root} className="mb-7">
      <div className="flex items-center gap-3">
        {Icon ? (
          <span data-chip className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", chipTone)}>
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
          </span>
        ) : null}
        {kicker ? <p data-kicker className="text-[13px] font-medium text-text-muted">{kicker}</p> : null}
      </div>
      <h1 className="mt-5 text-[1.85rem] leading-[1.05] text-text-primary sm:text-[2.3rem]">
        {String(title).split(" ").map((w, i) => (
          <span key={`${w}-${i}`} className="lamp-word">
            <span>{w}{NBSP}</span>
          </span>
        ))}
      </h1>
      {children ? <div data-body className="mt-3 max-w-[42ch] text-sm leading-6 text-text-muted">{children}</div> : null}
    </div>
  );
}

/* ── Notice ──────────────────────────────────────────────────────── */
const NOTICE = {
  error:   { cls: "border-danger/30 bg-danger/10 text-danger",       Icon: AlertCircle },
  success: { cls: "border-success/30 bg-success/10 text-success",    Icon: CheckCircle2 },
  info:    { cls: "border-primary/30 bg-primary/10 text-primary",    Icon: Info },
  warning: { cls: "border-warning/30 bg-warning/10 text-warning",    Icon: TriangleAlert },
};

export function AuthNotice({ tone = "info", icon, children, className }) {
  const reduced = useReducedMotion();
  const { cls, Icon: DefaultIcon } = NOTICE[tone] || NOTICE.info;
  const Icon = icon || DefaultIcon;
  return (
    <motion.div
      role={tone === "error" ? "alert" : "status"}
      initial={reduced ? false : { opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? undefined : { opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-6", cls, className)}
    >
      <Icon className="mt-[3px] h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </motion.div>
  );
}

/* ── Password meter ──────────────────────────────────────────────── */
// A 1/x-style curve: the fill creeps toward the dashed asymptote as
// the password improves. Purely a hint; the server's rule
// (MIN_PASSWORD_LENGTH) is still what the form enforces.
const NBSP = String.fromCharCode(160);
const METER_CURVE = "M4 6 C 26 34, 70 40, 236 42";

export function scorePassword(pw, minLength = 8) {
  if (!pw) return 0;
  if (pw.length < minLength) return Math.min(0.24, (pw.length / minLength) * 0.24);
  let s = 0.4;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 0.15;
  if (/\d/.test(pw)) s += 0.15;
  if (/[^A-Za-z0-9]/.test(pw)) s += 0.15;
  if (pw.length >= minLength + 4) s += 0.15;
  return Math.min(1, s);
}

function meterLabel(score) {
  if (score === 0) return null;
  if (score < 0.4) return { text: "Too short", cls: "text-danger" };
  if (score < 0.6) return { text: "Fair", cls: "text-warning" };
  if (score < 0.85) return { text: "Good", cls: "text-primary" };
  return { text: "Strong", cls: "text-success" };
}

export function PasswordMeter({ value, minLength = 8 }) {
  const reduced = useReducedMotion();
  const score = scorePassword(value, minLength);
  const label = meterLabel(score);
  const color = score < 0.4 ? "rgb(var(--color-danger))" : score < 0.6 ? "rgb(var(--color-warning))" : score < 0.85 ? "rgb(var(--lamp))" : "rgb(var(--color-success))";

  return (
    <AnimatePresence initial={false}>
      {value ? (
        <motion.div
          key="meter"
          initial={reduced ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={reduced ? undefined : { opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
          aria-hidden="true"
        >
          <div className="flex items-end gap-4 pt-1">
            <svg viewBox="0 0 240 46" fill="none" className="h-8 w-40 shrink-0 overflow-visible">
              <line x1="0" y1="44" x2="240" y2="44" stroke="rgb(var(--rule))" strokeWidth="1.2" strokeDasharray="4 6" />
              <path d={METER_CURVE} stroke="rgb(var(--rule))" strokeWidth="2" strokeLinecap="round" />
              <motion.path
                d={METER_CURVE}
                stroke={color}
                strokeWidth="2.4"
                strokeLinecap="round"
                initial={false}
                animate={{ pathLength: Math.max(0.02, score) }}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
                style={{ filter: `drop-shadow(0 0 5px ${color})` }}
              />
            </svg>
            {label ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={label.text}
                  initial={reduced ? false : { y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduced ? undefined : { y: -8, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn("pb-0.5 text-[13px] font-medium", label.cls)}
                >
                  {label.text}
                </motion.span>
              </AnimatePresence>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
