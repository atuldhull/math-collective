import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import MonumentBackground from "@/components/backgrounds/MonumentBackground";
import { useMonument } from "@/hooks/useMonument";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { useAuthStore } from "@/store/auth-store";
import { auth } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { dashboardForRole } from "@/lib/roles";
import CodeSignIn from "@/features/auth/components/CodeSignIn";

export default function LoginPage() {
  useMonument("city");
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

  return (
    <div style={{ position: "relative" }}>
      <MonumentBackground monument="city" intensity={0.35} />

      {/* Ambient math glyphs scattered behind the card — adds depth so
          the form doesn't read as a single floating panel. Each glyph
          renders very low-opacity (0.04-0.06) so it's atmosphere, not
          content. `pointer-events-none` so they never block clicks. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 select-none">
        <span className="math-text absolute left-[4%] top-[8%] text-[8rem] text-white/[0.035]">∫</span>
        <span className="math-text absolute right-[6%] top-[14%] text-[10rem] text-primary/[0.05]">π</span>
        <span className="math-text absolute left-[12%] top-[58%] text-[6rem] text-white/[0.035]">Σ</span>
        <span className="math-text absolute right-[10%] bottom-[10%] text-[7rem] text-secondary/[0.05]">∞</span>
        <span className="math-text absolute left-[40%] top-[35%] text-[5rem] text-white/[0.03]">√</span>
        <span className="math-text absolute right-[35%] top-[68%] text-[6rem] text-white/[0.03]">∂</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full"
      >
        <div
          className="relative overflow-hidden border border-line/20 bg-surface/60 p-8 shadow-panel backdrop-blur-2xl sm:p-10"
          style={{ clipPath: "var(--clip-notch)", borderTop: "2px solid var(--monument-city)" }}
        >
          {/* Foreground accent symbol — bigger now (10rem from 6) and
              positioned to anchor the card visually. Sits inside the
              card so backdrop-blur affects it; the wider ambient
              glyphs above sit OUTSIDE the card on the page background. */}
          <span
            className="math-text pointer-events-none absolute -right-4 -top-6 select-none"
            style={{ fontSize: "10rem", opacity: 0.05, lineHeight: 1 }}
          >
            λ
          </span>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mb-8"
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Welcome Back</p>
            <h1 className="mt-3 font-display text-[2rem] font-extrabold tracking-[-0.05em] text-white sm:text-4xl">
              Sign in to your account
            </h1>
            <p className="mt-3 text-sm text-text-muted">
              Continue your math journey. Your challenges are waiting.
            </p>
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
              style={{ clipPath: "var(--clip-notch)" }}
            >
              {error}
            </motion.div>
          )}

          {mode === "code" ? (
            <CodeSignIn onSignedIn={goAfterSignIn} />
          ) : (
          <motion.form
            onSubmit={handleSubmit}
            className="space-y-5"
            initial="hidden"
            animate="visible"
            variants={{
              hidden:  { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.25 } },
            }}
          >
            <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <InputField
                label="Email"
                type="email"
                placeholder="yourname@bmsit.in"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <InputField
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <Button type="submit" loading={loading} className="w-full justify-center" size="lg">
                Sign In
              </Button>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForgot(true)} className="w-full justify-center">
                Forgot password?
              </Button>
            </motion.div>
          </motion.form>
          )}

          {/* Switch between the two ways in. Code is the default: no
              password to forget, and it proves the college mailbox. */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setMode(mode === "code" ? "password" : "code"); setError(null); setShowForgot(false); }}
            className="mt-4 w-full justify-center"
          >
            {mode === "code" ? "Sign in with a password instead" : "Email me a code instead"}
          </Button>

          {/* Forgot Password */}
          {mode === "password" && showForgot && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="mt-5 border border-line/15 bg-panel/50 p-5" style={{ clipPath: "var(--clip-notch)" }}>
              <p className="text-sm font-medium text-white">Reset your password</p>
              <p className="mt-1 text-xs text-text-dim">We'll send a reset link to your email</p>
              {forgotMsg && (
                <div className={`mt-3 px-3 py-2 text-xs ${forgotMsg.type === "success" ? "border border-success/30 bg-success/10 text-success" : "border border-danger/30 bg-danger/10 text-danger"}`}>
                  {forgotMsg.text}
                </div>
              )}
              <form onSubmit={handleForgot} className="mt-3 flex gap-2">
                <InputField
                  type="email"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button type="submit" size="sm" loading={forgotLoading}>Send</Button>
              </form>
              <Button variant="ghost" size="sm" onClick={() => setShowForgot(false)} className="mt-2">Cancel</Button>
            </motion.div>
          )}

          <div className="mt-6 text-center text-sm text-text-muted">
            Don't have an account?{" "}
            <Link to="/register" className="font-medium text-primary transition hover:text-secondary">
              Create one
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
