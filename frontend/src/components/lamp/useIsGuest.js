import { useAuthStore } from "@/store/auth-store";

/**
 * True when nobody is signed in. Public pages use it to give visitors
 * the long WorldIntro entrance and members a quick PageHeader instead.
 * While the session is still resolving this reports false, so members
 * never see a guest intro flash in.
 */
export default function useIsGuest() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  return status !== "idle" && status !== "loading" && !(status === "authenticated" && user);
}
