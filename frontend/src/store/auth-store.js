import { create } from "zustand";
import http from "@/lib/http";
import { setupPushNotifications, teardownPushNotifications } from "@/lib/pushNotifications";

// Whether this browser last had a session. Read on the very first paint,
// before /auth/me can answer, so a returning member is not shown the
// visitor design for a second and then swapped. It is a hint for
// presentation only — never a substitute for the server's answer, which
// always overrides it a moment later.
const MEMBER_HINT = "mc.hadSession";
export function rememberedMember() {
  try { return localStorage.getItem(MEMBER_HINT) === "1"; } catch { return false; }
}
function setMemberHint(on) {
  try { on ? localStorage.setItem(MEMBER_HINT, "1") : localStorage.removeItem(MEMBER_HINT); } catch { /* private mode */ }
}

// Best-effort, fire-and-forget. Never throw back to the auth flow.
function tryPushSetup(opts) {
  setupPushNotifications(opts).catch(() => {});
}

// Guards the confirmation check below: a page that fires six requests at
// once, all of which 401, must still only ask /auth/me once.
let expiryCheckInFlight = false;

export const useAuthStore = create((set, _get) => ({
  status: "idle", // idle | loading | authenticated | guest | error
  user: null,
  error: null,

  // Check session on app load — uses /api/auth/me which returns { loggedIn, user }
  checkSession: async () => {
    try {
      set({ status: "loading" });
      const { data } = await http.get("/auth/me");
      if (data.loggedIn && data.user) {
        setMemberHint(true);
        set({ user: data.user, status: "authenticated", error: null });
        // If permission was granted on a previous visit, silently refresh
        // the push subscription so it stays bound to this session user.
        tryPushSetup({ promptIfDefault: false });
      } else {
        setMemberHint(false);
        set({ user: null, status: "guest", error: null });
      }
    } catch {
      // 401 or network error = not logged in
      setMemberHint(false);
      set({ user: null, status: "guest", error: null });
    }
  },

  /**
   * A 401 from one endpoint is not proof the session is gone.
   * /chat/relationships/batch, /user/stats and friends can each return
   * 401 for their own reasons — a race against the CSRF token, a server
   * restart, an endpoint a given role may not touch. Taking any of them
   * at face value logged members out at random.
   *
   * So ask the one endpoint whose job is answering this. Only if it says
   * the session is gone do we clear it; otherwise the 401 was that one
   * call's problem and the session stands.
   */
  verifySessionOrExpire: async () => {
    if (expiryCheckInFlight) return;
    expiryCheckInFlight = true;
    try {
      const { data } = await http.get("/auth/me");
      if (data.loggedIn && data.user) {
        setMemberHint(true);
        set({ user: data.user, status: "authenticated", error: null });
        return;
      }
    } catch {
      // fall through — treat an unanswerable session as gone
    } finally {
      expiryCheckInFlight = false;
    }
    setMemberHint(false);
    set({ user: null, status: "guest", error: "Your session has expired. Please sign in again." });
  },

  login: async (email, password) => {
    try {
      set({ status: "loading", error: null });
      const { data } = await http.post("/auth/login", { email, password });
      // Backend returns { message, user, redirectTo }
      if (data.user) {
        set({ user: data.user, status: "authenticated", error: null });
        // Prompt for notification permission once, on first successful login.
        // If the user dismisses, we won't re-prompt on subsequent logins —
        // setupPushNotifications inspects Notification.permission first.
        tryPushSetup({ promptIfDefault: true });
      }
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || "Login failed";
      set({ status: "error", error: msg });
      throw new Error(msg, { cause: err });
    }
  },

  /* College-email sign-in. Mirrors login() exactly — same store
     transitions, same push-permission prompt — so the two paths cannot
     leave the app in different states. */
  signInWithCode: async (email, token) => {
    try {
      set({ status: "loading", error: null });
      const { data } = await http.post("/auth/signin-code/verify", { email, token });
      if (data.user) {
        set({ user: data.user, status: "authenticated", error: null });
        tryPushSetup({ promptIfDefault: true });
      }
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || "Sign-in failed";
      set({ status: "error", error: msg });
      throw new Error(msg, { cause: err });
    }
  },

  register: async (name, email, password) => {
    try {
      set({ status: "loading", error: null });
      const { data } = await http.post("/auth/register", { name, email, password });
      set({ status: "guest", error: null });
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || "Registration failed";
      set({ status: "error", error: msg });
      throw new Error(msg, { cause: err });
    }
  },

  logout: async () => {
    setMemberHint(false);
    // Tear down the push subscription BEFORE destroying the server session —
    // otherwise the unsubscribe POST would 401.
    try { await teardownPushNotifications(); } catch { /* non-fatal */ }
    try {
      await http.post("/auth/logout");
    } catch {
      // ignore — local state reset below runs regardless
    }
    set({ user: null, status: "guest", error: null });
  },

  /**
   * Called by the HTTP 401 interceptor when an authenticated request is
   * rejected — means the server session expired. Wipes local state so
   * ProtectedRoute redirects to /login on the next render.
   */
  handleSessionExpired: () => {
    setMemberHint(false);
    set({ user: null, status: "guest", error: "Your session has expired. Please sign in again." });
  },

  clearError: () => set({ error: null }),
}));
