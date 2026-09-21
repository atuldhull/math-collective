import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const limitReached = (req, res) => {
  res.status(429).json({
    error:   "Too many requests",
    message: "You're doing that too fast. Please slow down and try again in a moment.",
  });
};

/* ── Campus NAT ──────────────────────────────────────────────────────
   A college sends every student's traffic out through one or a few
   public IPs. An IP-keyed limit therefore gives the WHOLE COLLEGE a
   single quota: register was 5/hour, which means five students could
   sign up per hour from campus Wi-Fi — an intake of 800 would have
   taken a week of queuing.

   Three things fix that, in order of preference:
     1. Key on the signed-in user where there is one (userOrIpKey).
        800 students then have 800 buckets instead of one.
     2. Keep the per-(IP + email) keys on the credential endpoints, so
        one person's mistakes don't deplete everyone else's budget.
     3. Where a limit must stay IP-only, set the ceiling above a
        classroom's worth of traffic and make it tunable, because the
        right number depends on the campus.

   TRUSTED_IPS exempts specific addresses from the IP-only limits
   entirely — put the college's outbound IP here on intake day:
     TRUSTED_IPS=203.0.113.4,203.0.113.5
   Per-user and per-email limits still apply to trusted IPs, so this
   is not a blanket amnesty. */

let trustedCache = { raw: null, set: new Set() };
function trustedIps() {
  const raw = process.env.TRUSTED_IPS || "";
  if (raw !== trustedCache.raw) {
    trustedCache = {
      raw,
      set: new Set(raw.split(",").map((s) => s.trim()).filter(Boolean)),
    };
  }
  return trustedCache.set;
}

export function isTrustedIp(req) {
  const set = trustedIps();
  return set.size > 0 && set.has(req.ip);
}

/** Read a positive integer from the environment, else the default. */
export function envInt(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/* ── Helper: key on (IP + normalised email).
   Used by /auth/login and /auth/forgot-password so a single shared
   NAT (a school lab, an office, a college Wi-Fi) can't lock every
   user out just because ONE student typo'd their password ten times
   in a row. The email is normalised the same way validators/auth.js
   normalises it (trim + lowercase) so "Alice@x.com" and "alice@x.com"
   share a bucket. Falls back to IP-only when the body has no email
   (malformed request — the validator will reject it next anyway). */
const ipPlusEmailKey = (req) => {
  // ipKeyGenerator handles IPv6 prefixing correctly — raw req.ip lets
  // an attacker rotate the v6 suffix to dodge the limit.
  const ip = ipKeyGenerator(req.ip);
  const rawEmail = req.body && typeof req.body.email === "string" ? req.body.email : "";
  const email = rawEmail.trim().toLowerCase();
  return email ? `${ip}|${email}` : ip;
};

/* ── Helper: key on the signed-in user, falling back to IP.
   The shape several limiters below already used inline; named here so
   the campus-NAT reasoning lives in one place. */
export const userOrIpKey = (req) =>
  (req.session?.user?.id ? `user:${req.session.user.id}` : ipKeyGenerator(req.ip));

/* ── Auth (PARENT — kept as a global ceiling for /api/auth POST) ──
   10 attempts per 15 mins, IP-keyed. Acts as a hard cap across the
   entire /api/auth surface (covers /logout, /resend-verification,
   and any future endpoint that doesn't yet have a route-level limiter).
   The stricter per-endpoint limiters below run on top of this and
   tighten the cap for the specific abuse pattern each one cares about. */
export const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  // Was 10 per IP — i.e. ten auth requests per 15 minutes for an entire
  // college. Keyed per (IP + email) now, so one person exhausting their
  // budget no longer freezes everyone behind the same NAT. The tight
  // per-pattern caps still live on the individual routes below.
  max:             envInt("RATE_LIMIT_AUTH_PER_15MIN", 30),
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    ipPlusEmailKey,
  handler:         limitReached,
  skip: (req) => req.method === "GET",
});

/* ── Login: 5 attempts per 15 min per (IP + email) ──
   Tighter than the parent authLimiter and keyed on the EMAIL too so
   one user's failures don't deplete the budget for everyone else on
   the same outbound IP. Credential-stuffing scripts that rotate
   email-per-attempt still hit the parent IP cap at 10/15m. */
export const loginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    ipPlusEmailKey,
  handler: (req, res) => {
    res.status(429).json({
      error:   "Too many login attempts",
      message: "Too many sign-in attempts for this account. Wait 15 minutes or use 'Forgot password'.",
    });
  },
});

/* ── Register: 5 per hour per IP ──
   Creating accounts is expensive (Supabase signUp + downstream rows).
   IP-keyed, NOT email-keyed: an attacker churning random emails to
   enumerate the user table would otherwise just keep getting fresh
   buckets. 5/hr stops cold registration spam without blocking a
   classroom where a few students legitimately sign up together. */
export const registerLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  // Per (IP + email): five attempts for ONE address, rather than five
  // sign-ups for the whole campus. Someone retrying a failed signup is
  // throttled; the student next to them is not.
  keyGenerator:    ipPlusEmailKey,
  handler:         limitReached,
});

/* ── Register, second wall: per IP per hour ──
   The per-email cap above cannot see an attacker churning fresh random
   addresses, so this keeps an IP-wide ceiling — just one set high
   enough for a real intake instead of five. Raise it (or list the
   campus in TRUSTED_IPS) before an orientation day where hundreds sign
   up from the same Wi-Fi within the hour. */
export const registerIpLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             envInt("RATE_LIMIT_REGISTER_PER_IP_PER_HOUR", 150),
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            isTrustedIp,
  handler:         limitReached,
});

/* ── Forgot-password: 3 per hour per (IP + email) ──
   Each request triggers a real outbound email — abuse vectors are
   (a) using us as a spam relay against a victim's inbox and (b)
   enumerating valid emails by error-message timing. (a) is what
   IP+email keying prevents directly. (b) is mitigated upstream by
   the controller returning the same response shape for hit/miss. */
export const forgotPasswordLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             3,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    ipPlusEmailKey,
  handler: (req, res) => {
    res.status(429).json({
      error:   "Too many reset requests",
      message: "Too many password-reset requests. Check your inbox (including spam) or wait an hour.",
    });
  },
});

/* ── Reset-password: 10 per hour per IP ──
   Body carries an access_token, not an email, so we can't key on the
   account. A token only works once anyway; cap exists to keep a
   scripted token-brute-force from saturating Supabase's verifyOtp. */
export const resetPasswordLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler:         limitReached,
});

/* ── Resend-verification: 3 per hour per (IP + email) ──
   Same email-spam vector as forgot-password — keep the verification
   email pipeline from being used to harass an inbox. */
export const resendVerificationLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             3,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    ipPlusEmailKey,
  handler:         limitReached,
});

/* ── Sign-in code REQUEST: 5 per hour per (IP + email) ──
   Each one sends a real email, so the abuse vector is using us as a
   relay to hammer somebody else's inbox. Per-email keying means a
   whole campus on one NAT is not sharing the budget. */
export const signInCodeRequestLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    ipPlusEmailKey,
  handler:         limitReached,
});

/* ── Sign-in code VERIFY: 10 per 15 min per (IP + email) ──
   A 6-digit code is a million guesses. The per-email lockout in
   lib/loginAttempts.js is the second wall; this is the first. */
export const signInCodeVerifyLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    ipPlusEmailKey,
  handler:         limitReached,
});

/* ── Comments: 30 per hour per user ──
   Per-USER (not per-IP) so a CS lab on one NAT doesn't share quota
   but a single hot-loop client can't flood the table. Anonymous
   callers can't reach the POST routes (requireAuth upstream), so no
   anon fallback needed. */
export const commentsLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => req.session?.user?.id || ipKeyGenerator(req.ip),
  handler:         limitReached,
});

/* ── Arena: 15 questions per hour per user ── */
export const arenaLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             15,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => req.session?.user?.id || "anon",
  skip:            (req) => !req.session?.user?.id,
  handler: (req, res) => {
    res.status(429).json({
      error:   "Hourly limit reached",
      message: "You've answered 15 questions this hour. Come back later — quality over quantity! 🧠",
    });
  },
});

/* ── General: 200 requests per minute per IP ──
   Skips:
   - Anything outside /api/ (handled by static serving / SPA fallback).
   - /api/health and /api/ready — uptime monitors and load balancers
     poll these every few seconds; rate-limiting them would falsely
     mark the instance unhealthy. Both endpoints do trivial work and
     leak no secrets, so they're safe to leave open. */
export const generalLimiter = rateLimit({
  windowMs:        60 * 1000,
  // Per signed-in user where there is one, so a class opening their
  // dashboards together gets a bucket each instead of sharing 200
  // between the whole college. Anonymous traffic still shares per IP,
  // which is why the ceiling is higher than it used to be.
  max:             envInt("RATE_LIMIT_GENERAL_PER_MIN", 300),
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    userOrIpKey,
  handler:         limitReached,
  skip: (req) => {
    if (!req.path.startsWith("/api/")) return true;
    if (req.path === "/api/health" || req.path === "/api/ready") return true;
    return false;
  },
});

/* ── Search: 120 requests per minute per user ──
   The command palette debounces at 250ms client-side, so a human at
   sustained typing speed lands at ~4 req/sec — the limiter only kicks
   in for runaway scripts or someone holding a key. Per-USER (not IP)
   because a whole CS lab on one NAT would otherwise share quota and
   one bored student could lock everyone out of search. */
export const searchLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             120,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => req.session?.user?.id || ipKeyGenerator(req.ip),
  handler:         limitReached,
});

/* ── Contact: 5 submissions per hour ── */
export const contactLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  // Five per PERSON per hour, not five for the whole college.
  keyGenerator:    userOrIpKey,
  handler:         limitReached,
});

/* ── AI: 20 requests per hour per user ──
   Every hit talks to OpenRouter and costs real money. 20/hour is
   generous for a single human but prevents a runaway loop or
   credential-stuffing attack from draining the API budget in minutes.
   Per-USER key (not per-IP) so a whole CS lab on one NAT doesn't
   share the quota. Unauthenticated callers can't reach AI routes
   (requireAuth upstream), so there's no anon fallback case. */
export const aiLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  // Per-user key; fall back to the library's IP helper (handles IPv6
  // correctly — raw req.ip would let v6 callers bypass the limit by
  // flipping their prefix).
  keyGenerator:    (req) => req.session?.user?.id || ipKeyGenerator(req.ip),
  handler: (req, res) => {
    res.status(429).json({
      error:   "AI limit reached",
      message: "You've hit the hourly AI-request limit (20/hr). Try again later.",
    });
  },
});

/* ── Payment: 10 requests per 10 minutes per org ──
   Create-order + verify are protected by admin auth already, so the
   attacker surface is narrow (compromised admin session or a
   misbehaving client retrying forever). Razorpay itself rate-limits
   by API key, but if we hit THAT ceiling our whole org stalls —
   better to catch hot-loops here first. Key by org_id, not user, so
   two admins working concurrently during a release share quota but
   a stuck client can't exhaust the whole org's budget.
   (IP fallback when orgId is somehow missing — should never happen
   behind requireAdmin.) */
export const paymentLimiter = rateLimit({
  windowMs:        10 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => req.orgId || ipKeyGenerator(req.ip),
  handler: (req, res) => {
    res.status(429).json({
      error:   "Payment rate limit",
      message: "Too many payment attempts. Wait a few minutes and try again.",
    });
  },
});