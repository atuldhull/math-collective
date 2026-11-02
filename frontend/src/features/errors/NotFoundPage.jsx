import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { ArrowLeft } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { useAuthStore } from "@/store/auth-store";
import { dashboardForRole } from "@/lib/roles";
import Button from "@/components/ui/Button";

const motionOK = () =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

// y = k / (a - x): a curve racing up a vertical asymptote it never meets,
// and its mirror branch falling in from the far side.
const A = 300;
const BASE = 196;
const K = 2400;
function branch(from, to, step, sign) {
  const pts = [];
  for (let x = from; sign > 0 ? x <= to : x >= to; x += step * sign) {
    const y = BASE - K / Math.abs(A - x);
    if (y < -30) break;
    pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}
const LEFT = branch(16, A - 1, 4, 1);
const RIGHT = branch(392, A + 1, 3, -1);

/**
 * The graph: a dot rides the left branch, speeding up as it climbs the
 * asymptote at x = 404, and vanishes off the top before it can arrive.
 * Then it tries again. The page, like the function, tends to nowhere.
 */
function LimitGraph() {
  const root = useRef(null);
  useGSAP(() => {
    if (!motionOK()) return;
    const q = gsap.utils.selector(root);
    const left = q("[data-left]")[0];
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(q("[data-axis]"), { scaleX: 0, transformOrigin: "0% 50%", duration: 1.2 }, 0)
      .from(q("[data-asym]"), { scaleY: 0, transformOrigin: "50% 100%", duration: 1.2 }, 0.15)
      .fromTo(q("[data-left], [data-right]"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.8, ease: "power2.inOut", stagger: 0.25 }, 0.3)
      .from(q("[data-asym-label]"), { autoAlpha: 0, y: 8, duration: 0.8 }, 1);

    const chase = gsap.timeline({ repeat: -1, repeatDelay: 0.6, delay: 2 });
    chase.set(q("[data-dot]"), { autoAlpha: 1 })
      .to(q("[data-dot]"), {
        motionPath: { path: left, align: left, alignOrigin: [0.5, 0.5] },
        duration: 3.2, ease: "power3.in",
      })
      .to(q("[data-dot]"), { autoAlpha: 0, duration: 0.25 }, "-=0.3")
      .fromTo(q("[data-asym]"), { opacity: 0.6 }, { opacity: 1, duration: 0.15, yoyo: true, repeat: 1 }, "<");
  }, { scope: root });

  return (
    <svg ref={root} viewBox="0 -30 400 240" fill="none" aria-hidden="true" className="h-auto w-full overflow-visible">
      {/* graph paper */}
      <g stroke="rgb(var(--rule))" strokeWidth="0.6" opacity="0.5">
        {[40, 80, 120, 160].map((y) => <line key={y} x1="0" x2="400" y1={y} y2={y} />)}
        {[50, 100, 150, 200, 250, 350].map((x) => <line key={x} y1="-30" y2="210" x1={x} x2={x} />)}
      </g>
      <line data-axis x1="0" x2="400" y1={BASE} y2={BASE} stroke="rgb(var(--color-text-dim))" strokeOpacity="0.6" strokeWidth="1.2" />
      <line data-asym x1={A} x2={A} y1="-30" y2="210" stroke="rgb(var(--lamp))" strokeOpacity="0.7" strokeWidth="1.4" strokeDasharray="5 6" />
      <text data-asym-label x={A + 8} y="-12" fill="rgb(var(--lamp))" fontSize="12" fontFamily="ui-monospace, monospace">x = 404</text>
      <path data-left d={LEFT} pathLength="1" strokeDasharray="1" stroke="rgb(var(--violet))" strokeWidth="2.4" strokeLinecap="round" />
      <path data-right d={RIGHT} pathLength="1" strokeDasharray="1" stroke="rgb(var(--violet))" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
      <circle data-dot r="6" cx="0" cy="0" fill="rgb(var(--lamp))" opacity="0" style={{ filter: "drop-shadow(0 0 8px rgb(var(--lamp)))" }} />
    </svg>
  );
}

export default function NotFoundPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const isAuth = status === "authenticated" && user;
  const homePath = isAuth ? dashboardForRole(user.role) : "/";
  const root = useRef(null);

  useGSAP(() => {
    if (!motionOK()) return;
    const q = gsap.utils.selector(root);
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(q("[data-digit]"), { yPercent: 110, rotate: (i) => (i - 1) * 10, duration: 1.2, stagger: 0.09 }, 0.1)
      .from(q("[data-copy] > *"), { y: 22, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, 0.45)
      .from(q("[data-graph]"), { y: 40, autoAlpha: 0, duration: 1.2 }, 0.2);
    // The zero drifts upward and back, as if pulled toward the line.
    gsap.to(q("[data-digit-zero]"), { y: -14, duration: 2.2, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.4 });
  }, { scope: root });

  return (
    <div ref={root} className="relative mx-auto grid min-h-[72vh] w-full max-w-5xl items-center gap-10 py-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
      <div data-copy className="order-2 text-center lg:order-1 lg:text-left">
        <p className="text-[13px] font-medium text-primary">Error 404</p>
        <p aria-hidden="true" className="lamp-numerals mt-2 flex justify-center gap-1 text-[6.5rem] leading-[0.9] text-text-primary sm:text-[8.5rem] lg:justify-start">
          <span className="lamp-word"><span data-digit>4</span></span>
          <span className="lamp-word"><span data-digit><span data-digit-zero className="inline-block text-primary [text-shadow:0_0_40px_rgb(var(--lamp)/0.5)]">0</span></span></span>
          <span className="lamp-word"><span data-digit>4</span></span>
        </p>
        <h1 className="lamp-display mt-4 text-[2rem] leading-[1.05] text-text-primary sm:text-5xl" style={{ textWrap: "balance" }}>
          This page tends to nowhere
        </h1>
        <p className="mx-auto mt-4 max-w-[46ch] text-base leading-7 text-text-muted lg:mx-0">
          The address you followed approaches a page that isn&rsquo;t there. Go back, or start again from {isAuth ? "your dashboard" : "the home page"}.
        </p>
        <p className="mt-3 font-mono text-[13px] text-text-dim">lim<sub>x→404</sub> f(x) does not exist</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
          <Button variant="secondary" onClick={() => navigate(-1)} leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}>
            Go back
          </Button>
          <Link
            to={homePath}
            className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-[rgb(var(--color-obsidian))] shadow-[0_10px_30px_-12px_rgb(var(--lamp)/0.75)] transition hover:brightness-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
          >
            {isAuth ? "Go to dashboard" : "Go home"}
          </Link>
        </div>
      </div>

      <div data-graph className="order-1 mx-auto w-full max-w-md lg:order-2 lg:max-w-none">
        <div className="lamp-panel p-4 sm:p-6">
          <LimitGraph />
        </div>
      </div>
    </div>
  );
}
