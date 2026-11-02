import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, KeyRound, Link2Off, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { auth } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { MIN_PASSWORD_LENGTH, PASSWORD_HELPER, PASSWORD_TOO_SHORT } from "@/lib/passwordPolicy";
import { AuthHeading, AuthNotice, PasswordMeter } from "@/features/auth/components/AuthChrome";

/**
 * /reset-password — the page a Supabase recovery email lands on.
 *
 * This used to live inside LoginPage behind a hash sniff, which broke
 * in three ways people actually hit:
 *   - LoginPage is wrapped in GuestOnlyRoute, so anyone still signed in
 *     was redirected to their dashboard before the form could render.
 *   - It only understood `#access_token=...`. A project on the OTP-hash
 *     template sends `?token_hash=...` instead, and those members got a
 *     plain login form with no explanation.
 *   - An expired link comes back as `#error=...&error_description=...`
 *     with no access_token, so the page silently showed the login form
 *     and the member assumed the reset link "did nothing".
 * This page is reachable while signed in, reads both token shapes, and
 * says out loud when the link itself is the problem.
 */

/** Pull the recovery token out of the fragment or the query string. */
export function readRecoveryParams(hash, search) {
  const fromHash  = new URLSearchParams((hash || "").replace(/^#/, ""));
  const fromQuery = new URLSearchParams(search || "");
  const pick = (k) => fromHash.get(k) || fromQuery.get(k);

  const linkError = pick("error_description") || pick("error");
  const accessToken = pick("access_token");
  // Supabase names it token_hash; some older templates send `token`.
  const tokenHash = pick("token_hash") || pick("token");

  if (accessToken) return { token: { access_token: accessToken }, linkError: null };
  if (tokenHash)   return { token: { token_hash: tokenHash }, linkError: null };
  return { token: null, linkError: linkError ? decodeURIComponent(linkError.replace(/\+/g, " ")) : null };
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const [token, setToken] = useState(null);
  const [linkError, setLinkError] = useState(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { token: t, linkError: e } = readRecoveryParams(
      window.location.hash,
      window.location.search,
    );
    setToken(t);
    setLinkError(
      e || (t ? null : "This reset link is missing its token. It may have been truncated by your email client — copy the whole link, or request a new one."),
    );
    // Strip the token from the address bar so it isn't kept in history
    // or leaked in a Referer header. It's already in component state.
    if (t) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const mismatch = confirmPw.length > 0 && newPw !== confirmPw;
  const tooShort = newPw.length > 0 && newPw.length < MIN_PASSWORD_LENGTH;
  const canSubmit = Boolean(token) && newPw.length >= MIN_PASSWORD_LENGTH && newPw === confirmPw;

  async function handleSubmit(e) {
    e.preventDefault();
    if (tooShort) { setMsg({ type: "error", text: PASSWORD_TOO_SHORT }); return; }
    if (newPw !== confirmPw) { setMsg({ type: "error", text: "Passwords don't match" }); return; }
    setLoading(true);
    setMsg(null);
    try {
      await auth.resetPassword(token, newPw);
      setDone(true);
      setMsg({ type: "success", text: "Password updated. Taking you to sign in…" });
      setTimeout(() => navigate("/login", { replace: true }), 1800);
    } catch (err) {
      setMsg({ type: "error", text: apiErrorMessage(err, "Failed to reset password") });
    } finally {
      setLoading(false);
    }
  }

  const icon = (Icon) => <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />;

  return (
    <div>
      <AuthHeading
        icon={linkError ? Link2Off : KeyRound}
        tone={linkError ? "bad" : "good"}
        kicker="Password recovery"
        title="Set a new password"
      >
        {linkError ? "We couldn't read your reset link." : `Choose a new password for your account. ${PASSWORD_HELPER}.`}
      </AuthHeading>

      <AnimatePresence initial={false}>
        {linkError && (
          <AuthNotice key="link" tone="error" icon={Link2Off} className="mb-5">{linkError}</AuthNotice>
        )}
        {msg && !done && (
          <AuthNotice key={msg.text} tone={msg.type === "success" ? "success" : "error"} className="mb-5">{msg.text}</AuthNotice>
        )}
      </AnimatePresence>

      {/* Success: a check stamps in while the redirect timer runs. */}
      <AnimatePresence>
        {done && (
          <motion.div
            key="done"
            initial={reduced ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center py-4 text-center"
            role="status"
          >
            <motion.span
              initial={reduced ? false : { scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-success/40 bg-success/10 text-success shadow-[0_0_40px_-8px_rgb(var(--color-success)/0.6)]"
            >
              <Check className="h-8 w-8" strokeWidth={2} aria-hidden="true" />
            </motion.span>
            <p className="mt-4 text-sm text-success">{msg?.text}</p>
            <span className="relative mt-4 h-1 w-40 overflow-hidden rounded-full bg-[rgb(var(--rule))]" aria-hidden="true">
              <motion.span
                className="absolute inset-0 origin-left rounded-full bg-success"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: reduced ? 0 : 1.8, ease: "linear" }}
              />
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {token && !done && (
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-5"
          initial="hidden"
          animate="visible"
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.45 } } }}
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }} className="space-y-2">
            <InputField
              label="New password"
              type="password"
              placeholder={PASSWORD_HELPER}
              helper={PASSWORD_HELPER}
              error={tooShort ? PASSWORD_TOO_SHORT : undefined}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              required
            />
            <PasswordMeter value={newPw} minLength={MIN_PASSWORD_LENGTH} />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
            <InputField
              label="Confirm password"
              type="password"
              placeholder="Repeat password"
              error={mismatch ? "Passwords do not match" : undefined}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              required
            />
          </motion.div>
          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
            <Button type="submit" loading={loading} disabled={!canSubmit} className="w-full justify-center" size="lg" leading={icon(KeyRound)}>
              Update password
            </Button>
          </motion.div>
        </motion.form>
      )}

      <p className="mt-7 text-center text-sm">
        <Link to="/login" className="inline-flex min-h-10 items-center gap-2 font-medium text-primary underline-offset-4 transition hover:underline">
          {linkError ? icon(RefreshCw) : icon(ArrowLeft)}
          {linkError ? "Request a new reset link" : "Back to sign in"}
        </Link>
      </p>
    </div>
  );
}
