import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CalendarClock, Gift, LogIn, Lock, Trophy, UserPlus } from "lucide-react";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { useAuthStore } from "@/store/auth-store";
import http from "@/lib/http";
import { AuthHeading, AuthNotice, PasswordMeter } from "@/features/auth/components/AuthChrome";

const EASE = [0.16, 1, 0.3, 1];
const field = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };
const icon = (Icon) => <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const register = useAuthStore((s) => s.register);
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const reduced = useReducedMotion();

  // Referral code from URL (?ref=MATH-XXXXX)
  const [refCode] = useState(() => searchParams.get("ref") || "");
  const [refValid, setRefValid] = useState(null); // null=checking, true/false
  const [refName, setRefName] = useState("");

  useEffect(() => {
    if (!refCode) { setRefValid(null); return; }
    http.get(`/referral/validate/${refCode}`)
      .then((res) => {
        setRefValid(res.data?.valid || false);
        setRefName(res.data?.referrerName || "");
      })
      .catch(() => setRefValid(false));
  }, [refCode]);

  // Check if registrations are open
  const [regOpen, setRegOpen] = useState(null); // null = loading, true/false = known
  const [regMessage, setRegMessage] = useState("");

  useEffect(() => {
    http.get("/events/settings")
      .then((res) => {
        const settings = res.data || {};
        const isOpen = settings.registrations_open !== "false";
        setRegOpen(isOpen);
        if (!isOpen) {
          setRegMessage(
            settings.registration_message ||
            "Registrations are currently closed. The admin will reopen them soon — check back later!"
          );
        }
      })
      .catch(() => {
        // If settings fail to load, allow registration (fail open)
        setRegOpen(true);
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(form.name, form.email, form.password);
      // Apply referral code if present (after account creation, before redirect)
      if (refCode && refValid) {
        try {
          await http.post("/referral/apply", { code: refCode });
        } catch { /* referral is best-effort, don't block registration */ }
      }
      // Replace (not push) — after successful register, back button should NOT
      // return to the register form (which would be confusing and potentially
      // re-submit a duplicate request).
      navigate("/login", { replace: true, state: { justRegistered: true } });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state while checking registration status ──
  if (regOpen === null) {
    return (
      <div className="flex min-h-[22rem] flex-col items-center justify-center gap-4" role="status">
        <motion.span
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          className="math-text text-5xl text-primary"
          style={{ filter: "drop-shadow(0 0 12px rgb(var(--lamp)/0.6))" }}
          aria-hidden="true"
        >
          ∑
        </motion.span>
        <p className="text-[13px] font-medium text-text-muted">Checking whether registrations are open</p>
      </div>
    );
  }

  // ── Registrations CLOSED ──
  if (!regOpen) {
    const next = [
      { Icon: CalendarClock, text: "Ask your admin or teacher when registrations reopen" },
      { Icon: LogIn, text: "If you already have an account, sign in below" },
      { Icon: Trophy, text: "Check the leaderboard and events while you wait" },
    ];
    return (
      <div>
        <div className="flex justify-center">
          <motion.span
            initial={reduced ? false : { scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", bounce: 0.45, delay: 0.3 }}
            className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 text-danger"
          >
            {!reduced ? (
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl border border-danger/40"
                animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.9 }}
              />
            ) : null}
            <Lock className="h-9 w-9" strokeWidth={1.5} aria-hidden="true" />
          </motion.span>
        </div>

        <motion.h1
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6, ease: EASE }}
          className="mt-6 text-center text-[1.85rem] leading-tight text-text-primary sm:text-3xl"
        >
          Registrations are closed
        </motion.h1>

        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-text-muted"
        >
          {regMessage}
        </motion.p>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6, ease: EASE }}
          className="mt-7 rounded-2xl border border-[rgb(var(--rule))] bg-surface/50 p-5"
        >
          <p className="text-[13px] font-medium text-text-primary">What you can do now</p>
          <motion.ul
            className="mt-3 space-y-3"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1, delayChildren: 1 } } }}
          >
            {next.map(({ Icon, text }) => (
              <motion.li key={text} variants={field} className="flex items-start gap-3 text-sm text-text-muted">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="pt-0.5">{text}</span>
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
          className="mt-6 grid gap-3 sm:grid-cols-2"
        >
          <Link to="/login" className="block">
            <Button size="lg" className="w-full justify-center" leading={icon(LogIn)}>Sign in instead</Button>
          </Link>
          <Link to="/leaderboard" className="block">
            <Button variant="secondary" size="lg" className="w-full justify-center" leading={icon(Trophy)}>View leaderboard</Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Registrations OPEN — normal form ──
  return (
    <div>
      <AuthHeading icon={UserPlus} kicker="Join the collective" title="Create your account" tone="violet">
        Start solving challenges, competing in events, and climbing the ranks.
      </AuthHeading>

      <AnimatePresence initial={false}>
        {refCode && refValid && (
          <AuthNotice key="ref-ok" tone="success" icon={Gift} className="mb-5">
            Referred by <strong>{refName}</strong> — you'll get <strong>50 bonus XP</strong> after signing up!
          </AuthNotice>
        )}
        {refCode && refValid === false && (
          <AuthNotice key="ref-bad" tone="warning" className="mb-5">
            Invalid referral code — but you can still register!
          </AuthNotice>
        )}
        {error && (
          <AuthNotice key="err" tone="error" className="mb-5">{error}</AuthNotice>
        )}
      </AnimatePresence>

      <motion.form
        onSubmit={handleSubmit}
        className="space-y-5"
        initial="hidden"
        animate="visible"
        variants={{
          hidden:  { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.45 } },
        }}
      >
        <motion.div variants={field}>
          <InputField label="Full Name" placeholder="Your display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </motion.div>
        <motion.div variants={field}>
          <InputField label="Email" type="email" placeholder="yourname@bmsit.in" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </motion.div>
        <motion.div variants={field} className="space-y-2">
          <InputField label="Password" type="password" placeholder="Create a secure password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <PasswordMeter value={form.password} />
        </motion.div>
        <motion.div variants={field}>
          <InputField
            label="Confirm Password"
            type="password"
            placeholder="Confirm your password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            required
          />
        </motion.div>
        <motion.div variants={field}>
          <Button type="submit" loading={loading} className="w-full justify-center" size="lg" trailing={icon(ArrowRight)}>
            Create Account
          </Button>
        </motion.div>
      </motion.form>

      <p className="mt-7 text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary underline-offset-4 transition hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
