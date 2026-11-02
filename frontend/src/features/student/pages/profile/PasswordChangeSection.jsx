import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, KeyRound } from "lucide-react";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { MIN_PASSWORD_LENGTH, PASSWORD_HELPER, PASSWORD_TOO_SHORT } from "@/lib/passwordPolicy";

export default function PasswordChangeSection({
  showPassword,
  setShowPassword,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  pwLoading,
  pwMessage,
  pwError,
  onSubmit,
}) {
  return (
    <section data-reveal="up" className="lamp-panel p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-text-muted">
              <KeyRound className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl text-text-primary">Change password</h2>
              <p className="text-[13px] text-text-muted">You&apos;ll need your current password.</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPassword(!showPassword)}
            aria-expanded={showPassword}
            trailing={<ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${showPassword ? "rotate-180" : ""}`} strokeWidth={1.75} />}
          >
            {showPassword ? "Hide" : "Show"}
          </Button>
        </div>

        <AnimatePresence>
          {showPassword && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
              onSubmit={onSubmit}
            >
              <div className="mt-6 space-y-4">
                <InputField
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  required
                />
                <InputField
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  /* State the rule up front. The form used to show no
                     hint at all, so the length requirement was only
                     discoverable by being rejected. */
                  helper={PASSWORD_HELPER}
                  error={
                    newPassword && newPassword.length < MIN_PASSWORD_LENGTH
                      ? PASSWORD_TOO_SHORT
                      : undefined
                  }
                  required
                />
                <InputField
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  error={
                    confirmPassword && newPassword !== confirmPassword
                      ? "Passwords do not match"
                      : undefined
                  }
                  required
                />

                {pwMessage && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-success"
                  >
                    {pwMessage}
                  </motion.p>
                )}
                {pwError && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, x: [0, -8, 6, -4, 0] }}
                    transition={{ duration: 0.4 }}
                    className="text-sm text-danger"
                  >
                    {pwError}
                  </motion.p>
                )}

                <Button
                  type="submit"
                  size="sm"
                  loading={pwLoading}
                  disabled={
                    !currentPassword
                    || newPassword.length < MIN_PASSWORD_LENGTH
                    || newPassword !== confirmPassword
                  }
                >
                  Update Password
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
    </section>
  );
}
