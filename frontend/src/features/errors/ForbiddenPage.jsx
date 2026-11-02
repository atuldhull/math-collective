import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { dashboardForRole } from "@/lib/roles";
import Button from "@/components/ui/Button";

// This page renders inside ProtectedRoute, so it stays on framer-motion
// (no GSAP import) to keep the route guard light.

// y = c + k / (x + d): a curve rising toward a horizontal asymptote it
// can approach forever and never cross. The line is the permission.
const CEIL = 40;
const curveY = (x) => CEIL + 3000 / (x + 12);
const XS = Array.from({ length: 48 }, (_, i) => 10 + (i / 47) * 360);
const PATH = `M${XS.map((x) => `${x.toFixed(1)} ${curveY(x).toFixed(1)}`).join(" L")}`;

// The dot's ride, sampled along the curve, then a pause at the line.
const CYCLE = 5.2;
const RIDE = 0.78;
const DOT_X = [...XS, XS[XS.length - 1]];
const DOT_Y = [...XS.map(curveY), curveY(XS[XS.length - 1])];
const DOT_T = [...XS.map((_, i) => (i / (XS.length - 1)) * RIDE), 1];

const ease = [0.16, 1, 0.3, 1];
const rise = (delay) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.8, ease },
});

function CeilingGraph({ reduced }) {
  return (
    <svg viewBox="0 0 400 220" fill="none" aria-hidden="true" className="h-auto w-full overflow-visible">
      <g stroke="rgb(var(--rule))" strokeWidth="0.6" opacity="0.5">
        {[80, 120, 160, 200].map((y) => <line key={y} x1="0" x2="400" y1={y} y2={y} />)}
        {[50, 100, 150, 200, 250, 300, 350].map((x) => <line key={x} y1="0" y2="210" x1={x} x2={x} />)}
      </g>
      <motion.line
        x1="0" x2="400" y1={CEIL} y2={CEIL}
        stroke="rgb(var(--color-danger))" strokeWidth="1.6" strokeDasharray="6 6"
        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease }}
      />
      <motion.path
        d={PATH}
        stroke="rgb(var(--violet))" strokeWidth="2.4" strokeLinecap="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.3, duration: 1.8, ease: "easeInOut" }}
      />
      {reduced ? null : (
        <motion.circle
          r="6"
          fill="rgb(var(--lamp))"
          style={{ filter: "drop-shadow(0 0 8px rgb(var(--lamp)))" }}
          initial={{ cx: DOT_X[0], cy: DOT_Y[0], opacity: 0 }}
          animate={{ cx: DOT_X, cy: DOT_Y, opacity: [0, 1, 1, 0] }}
          transition={{
            cx: { duration: CYCLE, times: DOT_T, ease: "linear", repeat: Infinity, delay: 2 },
            cy: { duration: CYCLE, times: DOT_T, ease: "linear", repeat: Infinity, delay: 2 },
            opacity: { duration: CYCLE, times: [0, 0.06, 0.92, 1], repeat: Infinity, delay: 2 },
          }}
        />
      )}
      {/* the lock sits on the line and flinches each time the dot gets close */}
      <motion.g
        initial={reduced ? false : { opacity: 0, y: -20 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, x: [0, 0, -4, 4, -2, 0, 0] }}
        transition={reduced ? undefined : {
          opacity: { delay: 1, duration: 0.6 },
          y: { delay: 1, duration: 0.9, ease: [0.34, 1.56, 0.64, 1] },
          x: { duration: CYCLE, times: [0, 0.74, 0.77, 0.8, 0.83, 0.86, 1], repeat: Infinity, delay: 2 },
        }}
      >
        <rect x="356" y={CEIL - 34} width="30" height="26" rx="6" fill="rgb(var(--color-danger)/0.18)" stroke="rgb(var(--color-danger))" strokeWidth="1.6" />
        <path d={`M362 ${CEIL - 34} v-6 a9 9 0 0 1 18 0 v6`} stroke="rgb(var(--color-danger))" strokeWidth="1.6" fill="none" />
        <circle cx="371" cy={CEIL - 21} r="2.4" fill="rgb(var(--color-danger))" />
      </motion.g>
      <text x="12" y={CEIL - 10} fill="rgb(var(--color-danger))" fontSize="12" fontFamily="ui-monospace, monospace">your access</text>
    </svg>
  );
}

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const isAuth = status === "authenticated" && user;
  const homePath = isAuth ? dashboardForRole(user.role) : "/";
  const reduced = useReducedMotion();

  return (
    <div className="relative mx-auto grid min-h-[72vh] w-full max-w-5xl items-center gap-10 py-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
      <div className="order-2 text-center lg:order-1 lg:text-left">
        <motion.p {...rise(0)} className="text-[13px] font-medium text-danger">Error 403</motion.p>

        <div aria-hidden="true" className="lamp-numerals mt-2 flex items-center justify-center gap-2 text-[6.5rem] leading-[0.9] text-text-primary sm:text-[8.5rem] lg:justify-start">
          {["4", "lock", "3"].map((ch, i) => (
            <span key={ch} className="lamp-word">
              <motion.span
                className="inline-block"
                initial={reduced ? false : { y: "110%", rotate: (i - 1) * 10 }}
                animate={{ y: 0, rotate: 0 }}
                transition={{ delay: 0.1 + i * 0.09, duration: 1.1, ease }}
              >
                {ch === "lock" ? (
                  <motion.span
                    className="relative grid h-[5.2rem] w-[5.2rem] place-items-center rounded-full border-2 border-danger/60 bg-danger/10 text-danger shadow-[0_0_50px_-10px_rgb(var(--color-danger)/0.7)] sm:h-[7rem] sm:w-[7rem]"
                    animate={reduced ? undefined : { rotate: [0, 0, -8, 8, -4, 0, 0] }}
                    transition={{ duration: CYCLE, times: [0, 0.74, 0.77, 0.8, 0.83, 0.86, 1], repeat: Infinity, delay: 2 }}
                  >
                    <Lock className="h-1/2 w-1/2" strokeWidth={1.75} />
                  </motion.span>
                ) : ch}
              </motion.span>
            </span>
          ))}
        </div>

        <motion.h1 {...rise(0.25)} className="lamp-display mt-4 text-[2rem] leading-[1.05] text-text-primary sm:text-5xl">
          Access denied.
        </motion.h1>
        <motion.p {...rise(0.32)} className="mx-auto mt-4 max-w-[46ch] text-base leading-7 text-text-muted lg:mx-0">
          {isAuth
            ? "Your account role doesn't have permission to view this page. If you think this is a mistake, ask your admin."
            : "You need to sign in to view this page."}
        </motion.p>
        <motion.p {...rise(0.38)} className="mt-3 text-[13px] text-text-dim">
          Like a curve under its asymptote, you can get close to this page but not onto it.
        </motion.p>

        <motion.div {...rise(0.45)} className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
          <Button variant="secondary" onClick={() => navigate(-1)} leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}>
            Go back
          </Button>
          <motion.div whileTap={{ scale: 0.96 }}>
            <Link
              to={homePath}
              className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-[rgb(var(--color-obsidian))] shadow-[0_10px_30px_-12px_rgb(var(--lamp)/0.75)] transition hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
            >
              {isAuth ? "Go to your dashboard" : "Sign in"}
            </Link>
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 40, rotateX: -12 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ delay: 0.2, duration: 1.1, ease }}
        style={{ transformPerspective: 900 }}
        className="order-1 mx-auto w-full max-w-md lg:order-2 lg:max-w-none"
      >
        <div className="lamp-panel p-4 sm:p-6">
          <CeilingGraph reduced={reduced} />
        </div>
      </motion.div>
    </div>
  );
}
