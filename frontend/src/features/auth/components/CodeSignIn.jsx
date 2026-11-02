import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCw, Send } from "lucide-react";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { useAuthStore } from "@/store/auth-store";
import { auth } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { cn } from "@/lib/cn";
import { AuthNotice } from "@/features/auth/components/AuthChrome";

/**
 * Sign in with a college email and a one-time code.
 *
 * Two steps: ask for the address, then exchange the emailed code for a
 * session. This is the primary route in because it solves three things
 * at once for a club whose members came in through a Google Form CSV:
 *
 *   - It proves the mailbox is real and belongs to whoever is typing,
 *     which is the "is this an actual student" check.
 *   - Verifying CLAIMS an imported students row that has no auth account
 *     yet, so a member keeps the XP and history already on their record.
 *   - There is no password to forget, which is what most of the
 *     "I can't log in" reports actually were.
 *
 * The server enforces the college domain; this form only mirrors it so
 * the message arrives before a wasted round trip.
 */

const STEPS = [
  { value: "email", label: "Your email" },
  { value: "code", label: "Enter code" },
];

/** Two-step rail: a lamp line fills from step one to step two. */
function StepRail({ step }) {
  const reduced = useReducedMotion();
  const at = step === "code" ? 1 : 0;
  return (
    <ol className="mb-6 flex items-center gap-3" aria-label="Sign-in steps">
      {STEPS.map((s, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={s.value} className={cn("flex items-center gap-3", i === 0 && "flex-1")} aria-current={current ? "step" : undefined}>
            <span className="flex items-center gap-2">
              <motion.span
                initial={false}
                animate={{ scale: current ? 1 : 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className={cn(
                  "relative flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors duration-500",
                  done ? "border-primary bg-primary text-[rgb(var(--color-obsidian))]"
                    : current ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-[rgb(var(--rule))] text-text-dim",
                )}
              >
                {current && !reduced ? (
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full border border-primary/50"
                    animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                  />
                ) : null}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={done ? "done" : "n"}
                    initial={reduced ? false : { scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={reduced ? undefined : { scale: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" /> : i + 1}
                  </motion.span>
                </AnimatePresence>
              </motion.span>
              <span className={cn("text-[13px] font-medium transition-colors", current ? "text-text-primary" : "text-text-muted")}>{s.label}</span>
            </span>
            {i === 0 ? (
              <span className="relative h-px flex-1 bg-[rgb(var(--rule))]" aria-hidden="true">
                <motion.span
                  className="absolute inset-0 origin-left bg-primary shadow-[0_0_8px_rgb(var(--lamp)/0.7)]"
                  initial={false}
                  animate={{ scaleX: at }}
                  transition={reduced ? { duration: 0 } : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function CodeSignIn({ onSignedIn }) {
  const signInWithCode = useAuthStore((s) => s.signInWithCode);
  const reduced = useReducedMotion();

  const [step, setStep]       = useState("email");   // email | code
  const [email, setEmail]     = useState("");
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);
  const codeRef               = useRef(null);

  async function handleRequest(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const { data } = await auth.requestSignInCode(email.trim());
      setStep("code");
      setMsg({ type: "info", text: data.message || "Check your inbox for your sign-in code." });
      // Focus the code box so a phone keyboard opens on the right field.
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setMsg({ type: "error", text: apiErrorMessage(err, "Couldn't send a code") });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const data = await signInWithCode(email.trim(), code.trim());
      onSignedIn?.(data);
    } catch (err) {
      setMsg({ type: "error", text: err.message || "That code didn't work" });
    } finally {
      setLoading(false);
    }
  }

  const tone = { error: "error", success: "success", info: "info" };
  const dir = step === "code" ? 1 : -1;
  const slide = {
    initial: (d) => (reduced ? { opacity: 0 } : { opacity: 0, x: 36 * d }),
    animate: { opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
    exit: (d) => (reduced ? { opacity: 0 } : { opacity: 0, x: -36 * d, transition: { duration: 0.2 } }),
  };
  const icon = (Icon) => <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />;

  return (
    <div>
      <StepRail step={step} />

      <AnimatePresence initial={false}>
        {msg && (
          <AuthNotice key={msg.text} tone={tone[msg.type] || "info"} className="mb-5">
            {msg.text}
          </AuthNotice>
        )}
      </AnimatePresence>

      {/* Hidden overflow only on x while the steps slide; the focus ring
          of the fields still has room thanks to the padding. */}
      <div className="-mx-1 overflow-x-clip px-1 py-1">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          {step === "email" ? (
            <motion.form key="email" onSubmit={handleRequest} className="space-y-5"
              custom={dir} variants={slide} initial="initial" animate="animate" exit="exit">
              <InputField
                label="College email"
                type="email"
                placeholder="yourname@bmsit.in"
                helper="Use your college address — we'll email you a code"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <Button type="submit" loading={loading} className="w-full justify-center" size="lg" trailing={icon(Send)}>
                Email me a code
              </Button>
            </motion.form>
          ) : (
            <motion.form key="code" onSubmit={handleVerify} className="space-y-5"
              custom={dir} variants={slide} initial="initial" animate="animate" exit="exit">
              <InputField
                ref={codeRef}
                label="Sign-in code"
                /* `inputMode numeric` opens the number pad on a phone without
                   the spinner arrows a type=number field would add.
                   Length is deliberately not stated anywhere: Supabase OTP
                   length is a project setting (6-10, this project uses 8),
                   so hardcoding "6-digit" in the UI would go stale the
                   moment somebody changes it. The validator accepts 4-10. */
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={10}
                placeholder="Code from your email"
                helper={`Sent to ${email}`}
                inputClassName="font-mono text-base tracking-[0.3em] placeholder:font-sans placeholder:text-sm placeholder:tracking-normal"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
              <Button type="submit" loading={loading} disabled={code.length < 4}
                className="w-full justify-center" size="lg" trailing={icon(ArrowRight)}>
                Sign in
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="ghost" size="md" leading={icon(ArrowLeft)}
                  onClick={() => { setStep("email"); setCode(""); setMsg(null); }}>
                  Use a different email
                </Button>
                <Button type="button" variant="ghost" size="md" loading={loading} leading={icon(RotateCw)}
                  onClick={handleRequest}>
                  Resend code
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
