import { motion } from "framer-motion";
import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { useAuthStore } from "@/store/auth-store";
import { auth } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";

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
export default function CodeSignIn({ onSignedIn }) {
  const signInWithCode = useAuthStore((s) => s.signInWithCode);

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
      setMsg({ type: "info", text: data.message || "Check your inbox for a 6-digit code." });
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

  const tone = {
    error:   "border-danger/30 bg-danger/10 text-danger",
    success: "border-success/30 bg-success/10 text-success",
    info:    "border-primary/30 bg-primary/10 text-primary",
  };

  return (
    <div className="space-y-5">
      {msg && (
        <div
          className={`border px-4 py-3 text-sm ${tone[msg.type] || tone.info}`}
          style={{ clipPath: "var(--clip-notch)" }}
        >
          {msg.text}
        </div>
      )}

      {step === "email" ? (
        <motion.form key="email" onSubmit={handleRequest} className="space-y-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
          <Button type="submit" loading={loading} className="w-full justify-center" size="lg">
            Email me a code
          </Button>
        </motion.form>
      ) : (
        <motion.form key="code" onSubmit={handleVerify} className="space-y-5"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <InputField
            ref={codeRef}
            label="6-digit code"
            /* `inputMode numeric` opens the number pad on a phone without
               the spinner arrows a type=number field would add. */
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            placeholder="123456"
            helper={`Sent to ${email}`}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
          />
          <Button type="submit" loading={loading} disabled={code.length < 4}
            className="w-full justify-center" size="lg">
            Sign in
          </Button>
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm"
              onClick={() => { setStep("email"); setCode(""); setMsg(null); }}>
              Use a different email
            </Button>
            <Button type="button" variant="ghost" size="sm" loading={loading}
              onClick={handleRequest}>
              Resend code
            </Button>
          </div>
        </motion.form>
      )}
    </div>
  );
}
