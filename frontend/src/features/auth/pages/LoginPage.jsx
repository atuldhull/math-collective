import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound, LogIn, MailCheck, X } from "lucide-react";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { useAuthStore } from "@/store/auth-store";
import { auth } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { dashboardForRole } from "@/lib/roles";
import CodeSignIn from "@/features/auth/components/CodeSignIn";
import { AuthHeading, AuthNotice } from "@/features/auth/components/AuthChrome";

const EASE = [0.16, 1, 0.3, 1];
const field = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // If ProtectedRoute bounced a guest here, go back there after login.
  const returnTo = location.state?.from || null;

  // ── Legacy recovery-link forwarding ──
  // Reset emails now point at /reset-password (see backend/lib/appUrl.js),
  // but links already sitting in inboxes — and anything still configured
  // against the project's old Site URL — land here with the recovery
  // token attached. Hand the whole fragment/query to the real page
  // rather than re-implementing the form in two places. navigate() is
  // basename-aware, so the "/app" mount is added for us.
  useEffect(() => {
    const { hash, search } = window.location;
    const isRecovery =
      hash.includes("type=recovery")
      || hash.includes("access_token=")
      || new URLSearchParams(search).get("type") === "recovery";
    if (isRecovery) navigate(`/reset-password${search}${hash}`, { replace: true });
  }, [navigate]);

  const login = useAuthStore((s) => s.login);
  const clearError = useAuthStore((s) => s.clearError);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Code sign-in is the default way in: no password to forget, it
  // proves the college mailbox is real, and it claims a CSV-imported
  // members row. Password stays available for anyone who set one.
  const [mode, setMode] = useState("code");   // code | password
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const reduced = useReducedMotion();

  const handleForgot = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setForgotMsg(null);
    try {
      const { data } = await auth.forgotPassword(forgotEmail);
      setForgotMsg({ type: "success", text: data.message || "Reset email sent! Check your inbox." });
    } catch (err) {
      setForgotMsg({ type: "error", text: apiErrorMessage(err, "Failed to send reset email") });
    }
    setForgotLoading(false);
  };

  /* Both sign-in paths land here so they cannot diverge on where a
     person ends up. Priority: the page they were bounced from, then the
     backend hint, then their role default. */
  const goAfterSignIn = (data) => {
    const target =
      returnTo
        || data?.redirectTo
        || dashboardForRole(data?.user?.role || data?.role);
    navigate(target, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    clearError();
    try {
      const data = await login(form.email, form.password);
      goAfterSignIn(data);
    } catch (err) {
      const msg = err.message || "Login failed";
      if (msg === "EMAIL_NOT_VERIFIED" || msg.includes("verify")) {
        setError("Please verify your email first. Check your inbox for the confirmation link.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // The two ways in swap like turning a page: one slides off, the
  // other arrives from the opposite side.
  const swapDir = mode === "password" ? 1 : -1;
  const swap = {
    initial: (d) => (reduced ? { opacity: 0 } : { opacity: 0, x: 28 * d, filter: "blur(4px)" }),
    animate: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: EASE } },
    exit: (d) => (reduced ? { opacity: 0 } : { opacity: 0, x: -28 * d, filter: "blur(4px)", transition: { duration: 0.2 } }),
  };
  const icon = (Icon) => <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />;

  return (
    <div className="relative">
      <AuthHeading icon={LogIn} kicker="Welcome back" title="Sign in to your account">
        Continue your math journey. Your challenges are waiting.
      </AuthHeading>

      <AnimatePresence initial={false}>
        {error && (
          <AuthNotice key="err" tone="error" className="mb-5">{error}</AuthNotice>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false} custom={swapDir}>
        {mode === "code" ? (
          <motion.div key="code" custom={swapDir} variants={swap} initial="initial" animate="animate" exit="exit">
            <CodeSignIn onSignedIn={goAfterSignIn} />
          </motion.div>
        ) : (
          <motion.div key="password" custom={swapDir} variants={swap} initial="initial" animate="animate" exit="exit">
            <motion.form
              onSubmit={handleSubmit}
              className="space-y-5"
              initial="hidden"
              animate="visible"
              variants={{
                hidden:  { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
              }}
            >
              <motion.div variants={field}>
                <InputField
                  label="Email"
                  type="email"
                  placeholder="yourname@bmsit.in"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </motion.div>
              <motion.div variants={field}>
                <InputField
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </motion.div>
              <motion.div variants={field}>
                <Button type="submit" loading={loading} className="w-full justify-center" size="lg" trailing={icon(ArrowRight)}>
                  Sign In
                </Button>
              </motion.div>
              <motion.div variants={field}>
                <Button type="button" variant="ghost" size="md" onClick={() => setShowForgot(true)} className="w-full justify-center" leading={icon(KeyRound)}>
                  Forgot password?
                </Button>
              </motion.div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Switch between the two ways in. Code is the default: no
          password to forget, and it proves the college mailbox. */}
      <div className="mt-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-[rgb(var(--rule))]" />
        <span className="text-[13px] text-text-dim">or</span>
        <span className="h-px flex-1 bg-[rgb(var(--rule))]" />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={() => { setMode(mode === "code" ? "password" : "code"); setError(null); setShowForgot(false); }}
        className="mt-4 w-full justify-center"
        leading={mode === "code" ? icon(KeyRound) : icon(MailCheck)}
      >
        {mode === "code" ? "Sign in with a password instead" : "Email me a code instead"}
      </Button>

      {/* Forgot Password */}
      <AnimatePresence initial={false}>
        {mode === "password" && showForgot && (
          <motion.div
            key="forgot"
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduced ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-5 rounded-2xl border border-[rgb(var(--rule))] bg-surface/50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-medium text-text-primary">Reset your password</p>
                  <p className="mt-1 text-[13px] text-text-muted">We'll send a reset link to your email</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  aria-label="Close reset form"
                  className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-dim transition hover:bg-white/[0.06] hover:text-text-primary"
                >
                  {icon(X)}
                </button>
              </div>
              <AnimatePresence initial={false}>
                {forgotMsg && (
                  <AuthNotice key={forgotMsg.text} tone={forgotMsg.type === "success" ? "success" : "error"} className="mt-3 text-[13px]">
                    {forgotMsg.text}
                  </AuthNotice>
                )}
              </AnimatePresence>
              <form onSubmit={handleForgot} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                <InputField
                  type="email"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="min-w-0 flex-1"
                />
                <Button type="submit" size="lg" loading={forgotLoading} className="justify-center">Send link</Button>
              </form>
              <Button variant="ghost" size="md" onClick={() => setShowForgot(false)} className="mt-2">Cancel</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-7 text-center text-sm text-text-muted">
        Don't have an account?{" "}
        <Link to="/signup" className="font-medium text-primary underline-offset-4 transition hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
