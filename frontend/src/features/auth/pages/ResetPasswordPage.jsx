import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import MonumentBackground from "@/components/backgrounds/MonumentBackground";
import { useMonument } from "@/hooks/useMonument";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { auth } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { MIN_PASSWORD_LENGTH, PASSWORD_HELPER, PASSWORD_TOO_SHORT } from "@/lib/passwordPolicy";

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
  useMonument("city");
  const navigate = useNavigate();

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

  return (
    <div style={{ position: "relative" }}>
      <MonumentBackground monument="city" intensity={0.35} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full">
        <div
          className="relative overflow-hidden border border-line/20 bg-surface/60 p-8 shadow-panel backdrop-blur-2xl sm:p-10"
          style={{ clipPath: "var(--clip-notch)", borderTop: "2px solid var(--monument-city)" }}
        >
          <span
            className="math-text pointer-events-none absolute right-4 top-4 select-none"
            style={{ fontSize: "6rem", opacity: 0.04, lineHeight: 1 }}
          >
            λ
          </span>

          <p className="font-mono text-xs uppercase tracking-[0.3em] text-success">Password Recovery</p>
          <h1 className="mt-3 font-display text-[2rem] font-extrabold tracking-[-0.05em] text-white">
            Set a new password
          </h1>
          <p className="mt-3 text-sm text-text-muted">
            {linkError ? "We couldn't read your reset link." : `Choose a new password for your account. ${PASSWORD_HELPER}.`}
          </p>

          {linkError && (
            <div
              className="mt-5 border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
              style={{ clipPath: "var(--clip-notch)" }}
            >
              {linkError}
            </div>
          )}

          {msg && (
            <div
              className={`mt-5 border px-4 py-3 text-sm ${msg.type === "success" ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}
              style={{ clipPath: "var(--clip-notch)" }}
            >
              {msg.text}
            </div>
          )}

          {token && !done && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <InputField
                label="New Password"
                type="password"
                placeholder={PASSWORD_HELPER}
                helper={PASSWORD_HELPER}
                error={tooShort ? PASSWORD_TOO_SHORT : undefined}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
                required
              />
              <InputField
                label="Confirm Password"
                type="password"
                placeholder="Repeat password"
                error={mismatch ? "Passwords do not match" : undefined}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                required
              />
              <Button type="submit" loading={loading} disabled={!canSubmit} className="w-full justify-center" size="lg">
                Update Password
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-text-muted">
            <Link to="/login" className="font-medium text-primary transition hover:text-secondary">
              {linkError ? "Request a new reset link" : "Back to sign in"}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
