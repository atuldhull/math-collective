import { useRef, useState } from "react";
import { Link, useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, Mail, Plus } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import LampBackdrop from "@/components/lamp/LampBackdrop";
import useAutoReveal from "@/components/lamp/useAutoReveal";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { usePublicStats } from "@/hooks/usePublicStats";

const faqs = [
  { q: "What is Asymptotes?", a: "A competitive mathematics platform where university students solve challenges, compete in live quizzes, and climb leaderboards." },
  { q: "Is it free to join?", a: "Yes! Students can register for free. Organisations choose a plan based on their needs." },
  { q: "How do live quizzes work?", a: "Teachers host real-time quizzes using Socket.IO. Students join with a code and answer questions under time pressure." },
  { q: "Can my university join?", a: "Absolutely. Contact us and we'll set up your organisation with a custom dashboard, branding, and student management." },
  { q: "What topics are covered?", a: "Calculus, Linear Algebra, Probability, Number Theory, Combinatorics, Topology, and more." },
  { q: "How is XP earned?", a: "Solve arena challenges correctly to earn XP. Harder problems give more XP. Weekly leaderboards track top performers." },
  { q: "Are certificates provided?", a: "Yes. Teachers can generate PDF certificates for events, competitions, and achievements." },
  { q: "Is there an AI assistant?", a: "Meet PANDA — our AI math tutor. It guides you with hints without giving direct answers. Available on every page." },
];

/* y = k/x, both branches, around an origin at (300, 180). Built once. */
const OX = 300;
const OY = 180;
const K = 2600;
function branch(sign) {
  const pts = [];
  for (let t = 9; t <= 292; t += t < 40 ? 1 : 6) {
    pts.push(`${(OX + sign * t).toFixed(1)} ${(OY - sign * (K / t)).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}
const BRANCH_A = branch(1);
const BRANCH_B = branch(-1);

// Glyphs on two orbits around the origin. Angles in degrees.
const OUTER = [["∫", 10], ["π", 70], ["Σ", 130], ["∞", 190], ["∂", 250], ["√", 310]];
const INNER = [["λ", 40], ["∇", 160], ["ϕ", 280]];

function FaqItem({ q, a, index }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const id = `auth-faq-${index}`;
  return (
    <div className="border-b border-[rgb(var(--rule))] last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="group flex min-h-[48px] w-full items-center justify-between gap-4 py-3 text-left"
      >
        <span className={`text-[15px] transition-colors duration-300 ${open ? "text-primary" : "text-text-primary group-hover:text-primary"}`}>{q}</span>
        <motion.span
          animate={{ rotate: open ? 135 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${open ? "border-primary/40 bg-primary/10 text-primary" : "border-[rgb(var(--rule))] text-text-dim"}`}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={id}
            key="a"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="max-w-[60ch] pb-4 pr-10 text-sm leading-6 text-text-muted">{a}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** The plotted hyperbola with glyphs orbiting its origin. */
function HyperbolaStage() {
  const root = useRef(null);

  useGSAP(() => {
    const q = gsap.utils.selector(root);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const branches = q("[data-branch]");
      const tl = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.5 });
      tl.from(q("[data-grid]"), { autoAlpha: 0, duration: 1.2, ease: "power1.out" })
        .from(q("[data-axis-x]"), { scaleX: 0, transformOrigin: "50% 50%", duration: 1.4 }, 0.1)
        .from(q("[data-axis-y]"), { scaleY: 0, transformOrigin: "50% 50%", duration: 1.4 }, 0.2);
      branches.forEach((p, i) => {
        const len = p.getTotalLength();
        tl.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 2.2, ease: "power3.inOut" }, 0.5 + i * 0.25);
      });
      tl.from(q("[data-glyph]"), { scale: 0, autoAlpha: 0, duration: 0.9, stagger: 0.06, ease: "back.out(2.2)" }, 1.2);

      // Two dots ride the branches toward the asymptotes they never meet.
      const riders = q("[data-rider]");
      riders.forEach((dot, i) => {
        const path = branches[i];
        const len = path.getTotalLength();
        const s = { t: 0 };
        const place = () => {
          const p = path.getPointAtLength(len * s.t);
          dot.setAttribute("cx", p.x);
          dot.setAttribute("cy", p.y);
        };
        place();
        tl.fromTo(dot, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 2 + i * 0.4);
        tl.to(s, { t: 0.995, duration: 4.4, ease: "power2.out", repeat: -1, repeatDelay: 0.8, onUpdate: place }, 2 + i * 0.4);
      });

      // Slow orbits; glyphs counter-rotate so they stay upright.
      gsap.to(q("[data-orbit-outer]"), { rotation: 360, duration: 90, ease: "none", repeat: -1 });
      gsap.to(q("[data-orbit-outer] [data-glyph]"), { rotation: -360, duration: 90, ease: "none", repeat: -1 });
      gsap.to(q("[data-orbit-inner]"), { rotation: -360, duration: 60, ease: "none", repeat: -1 });
      gsap.to(q("[data-orbit-inner] [data-glyph]"), { rotation: 360, duration: 60, ease: "none", repeat: -1 });

      // The plot leans toward the pointer.
      const tilt = q("[data-tilt]")[0];
      const rx = gsap.quickTo(tilt, "rotateX", { duration: 1.2, ease: "power3.out" });
      const ry = gsap.quickTo(tilt, "rotateY", { duration: 1.2, ease: "power3.out" });
      const onMove = (e) => {
        ry((e.clientX / window.innerWidth - 0.5) * 10);
        rx((e.clientY / window.innerHeight - 0.5) * -8);
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      return () => window.removeEventListener("pointermove", onMove);
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      q("[data-rider]").forEach((dot, i) => {
        const path = q("[data-branch]")[i];
        const p = path.getPointAtLength(path.getTotalLength() * 0.85);
        dot.setAttribute("cx", p.x);
        dot.setAttribute("cy", p.y);
      });
    });

    return () => mm.revert();
  }, { scope: root });

  const place = (deg, r) => {
    const rad = (deg * Math.PI) / 180;
    return { left: `${50 + r * Math.cos(rad)}%`, top: `${50 + r * Math.sin(rad)}%` };
  };

  return (
    <div ref={root} aria-hidden="true" className="relative mt-8 overflow-hidden rounded-[1.25rem] border border-[rgb(var(--rule))] bg-surface/40" style={{ perspective: 1200 }}>
      <div data-tilt className="relative aspect-[5/3] w-full" style={{ transformStyle: "preserve-3d" }}>
        <svg viewBox="0 0 600 360" fill="none" className="absolute inset-0 h-full w-full">
          <g data-grid stroke="rgb(var(--rule))" strokeWidth="0.6" opacity="0.7">
            {Array.from({ length: 11 }, (_, i) => <line key={`v${i}`} x1={i * 60} y1="0" x2={i * 60} y2="360" />)}
            {Array.from({ length: 7 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 60} x2="600" y2={i * 60} />)}
          </g>
          <line data-axis-x x1="0" y1={OY} x2="600" y2={OY} className="stroke-[rgb(var(--rule))]" strokeWidth="1.4" strokeDasharray="6 7" />
          <line data-axis-y x1={OX} y1="0" x2={OX} y2="360" className="stroke-[rgb(var(--rule))]" strokeWidth="1.4" strokeDasharray="6 7" />
          <path data-branch d={BRANCH_A} stroke="rgb(var(--lamp))" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 8px rgb(var(--lamp)/0.55))" }} />
          <path data-branch d={BRANCH_B} stroke="rgb(var(--violet))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 8px rgb(var(--violet)/0.45))" }} />
          <circle data-rider r="5.5" cx={OX} cy={OY} fill="rgb(var(--lamp))" style={{ filter: "drop-shadow(0 0 8px rgb(var(--lamp)))" }} />
          <circle data-rider r="4.5" cx={OX} cy={OY} fill="rgb(var(--violet))" style={{ filter: "drop-shadow(0 0 8px rgb(var(--violet)))" }} />
          <text x="568" y={OY - 10} className="fill-text-dim" fontSize="15" fontStyle="italic">x</text>
          <text x={OX + 10} y="22" className="fill-text-dim" fontSize="15" fontStyle="italic">y</text>
          <text x="404" y="88" className="fill-primary font-display" fontSize="20" fontStyle="italic">y = 1/x</text>
        </svg>

        {/* Centring lives on the outer div (CSS transform); GSAP only
            rotates the inner ring, so the two never fight. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[78%] -translate-x-1/2 -translate-y-1/2">
          <div data-orbit-outer className="absolute inset-0">
            {OUTER.map(([g, deg]) => (
              <span key={g} className="absolute -translate-x-1/2 -translate-y-1/2" style={place(deg, 50)}>
                <span data-glyph className="math-text block text-2xl text-text-primary/25 sm:text-3xl">{g}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[44%] -translate-x-1/2 -translate-y-1/2">
          <div data-orbit-inner className="absolute inset-0">
            {INNER.map(([g, deg]) => (
              <span key={g} className="absolute -translate-x-1/2 -translate-y-1/2" style={place(deg, 50)}>
                <span data-glyph className="math-text block text-xl text-secondary/45 sm:text-2xl">{g}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const TITLE = ["Every", "problem", "gets", "you", "closer."];
const NBSP = String.fromCharCode(160);

export default function AuthLayout() {
  // Real platform totals from /api/stats/public. Renders em-dashes
  // until the request resolves so we never flash a fake number.
  const stats = usePublicStats();
  const outlet = useOutlet();
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const rootRef = useRef(null);
  const storyRef = useRef(null);

  useAutoReveal(rootRef);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(storyRef);
      gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.15 })
        .from(q(".lamp-word > span"), { yPercent: 115, rotate: 4, duration: 1.2, stagger: 0.07 })
        .from(q("[data-lede]"), { y: 16, autoAlpha: 0, duration: 1 }, "<0.45");
    });
    return () => mm.revert();
  }, { scope: storyRef });

  // Card flip between forms. Going to register turns the card one way,
  // coming back turns it the other.
  const dir = pathname.endsWith("signup") ? 1 : -1;
  const flip = {
    initial: (d) => (reduced ? { opacity: 0 } : { rotateY: -80 * d, opacity: 0, scale: 0.96 }),
    animate: { rotateY: 0, opacity: 1, scale: 1, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
    exit: (d) => (reduced ? { opacity: 0 } : { rotateY: 80 * d, opacity: 0, scale: 0.96, transition: { duration: 0.32, ease: [0.7, 0, 0.84, 0] } }),
  };

  const linkCls = "inline-flex h-10 items-center gap-2 rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-3.5 text-[13px] font-medium text-text-muted backdrop-blur transition hover:border-primary/40 hover:text-text-primary";

  return (
    <div ref={rootRef} className="relative min-h-[100dvh] overflow-x-clip bg-obsidian text-text-primary">
      <LampBackdrop />

      <div className="relative z-10 mx-auto w-full max-w-[1320px] px-4 pb-16 pt-4 sm:px-8 sm:pt-6 lg:px-10">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <img src="/app/brand/club-logo-256.webp" alt="" width="256" height="256" className="h-11 w-11 shrink-0 object-contain sm:h-14 sm:w-14" />
            <span className="truncate font-display text-lg font-semibold tracking-[-0.02em] text-text-primary">Asymptotes</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-2">
            <Link to="/contact" className={`${linkCls} hidden sm:inline-flex`}>
              <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Contact us
            </Link>
            <Link to="/" className={linkCls}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Back home
            </Link>
          </nav>
        </header>

        <div className="mt-6 grid gap-10 lg:mt-10 lg:grid-cols-[1.12fr_0.88fr] lg:gap-14">
          {/* Story */}
          <section ref={storyRef} className="order-last min-w-0 lg:order-none" aria-label="About Asymptotes">
            <h2 className="lamp-display max-w-[13ch] text-[2.6rem] leading-[0.98] text-text-primary sm:text-6xl xl:text-[4.6rem]">
              {TITLE.map((w) => (
                <span key={w} className="lamp-word">
                  <span>{w}{NBSP}</span>
                </span>
              ))}
            </h2>
            <p data-lede className="mt-5 max-w-[46ch] text-base leading-7 text-text-muted sm:text-lg sm:leading-8">
              Where mathematics meets competition. Sign in to solve challenges, track your progress, and compete with the best minds on campus.
            </p>

            <HyperbolaStage />

            {/* Stats — real totals from /api/stats/public; em-dash until loaded. */}
            <dl data-stagger="up" className="mt-6 grid grid-cols-3 gap-3 sm:gap-6">
              {[
                ["Members", stats.members],
                ["Challenges", stats.challenges],
                ["Events", stats.events],
              ].map(([label, value]) => (
                <div key={label} className="border-l border-[rgb(var(--rule))] pl-3 sm:pl-4">
                  <dd className="lamp-numerals text-3xl text-text-primary sm:text-4xl">
                    <AnimatedNumber value={value} duration={1.8} />
                  </dd>
                  <dt className="mt-1 text-[13px] font-medium text-text-muted">{label}</dt>
                </div>
              ))}
            </dl>

            <div className="mt-12">
              <h2 data-reveal="up" className="text-2xl text-text-primary">Frequently asked questions</h2>
              <div data-stagger="up" className="lamp-panel mt-4 px-5 py-1 sm:px-6">
                {faqs.map((faq, i) => (
                  <FaqItem key={faq.q} q={faq.q} a={faq.a} index={i} />
                ))}
              </div>
              <p data-reveal="fade" className="mt-4 text-sm text-text-muted">
                Something else?{" "}
                <Link to="/contact" className="font-medium text-primary underline-offset-4 hover:underline">Contact us</Link>
              </p>
            </div>
          </section>

          {/* Form */}
          <main className="order-first min-w-0 lg:order-none">
            <div className="lg:sticky lg:top-8" style={{ perspective: 1600 }}>
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={pathname}
                  custom={dir}
                  variants={flip}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={{ transformStyle: "preserve-3d", transformOrigin: "50% 50%" }}
                  className="lamp-panel lamp-panel--lit mx-auto w-full max-w-[30rem] p-6 sm:p-9"
                >
                  {outlet}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
