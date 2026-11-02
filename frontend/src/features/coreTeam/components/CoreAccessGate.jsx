import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { Check, KeyRound } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { core } from "@/lib/api";
import { useCoreStore } from "@/store/core-store";
import Button from "@/components/ui/Button";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Shown inside the portal when an authenticated user is NOT yet a core
 * member. They redeem their private access code here to unlock it.
 *
 * The page is a locked door: an arched double door with lamplight
 * leaking under it. A wrong code rattles the door and flares the
 * keyhole red; the right one swings both leaves open into the light.
 */
export default function CoreAccessGate() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(false);
  const fetchMe = useCoreStore((s) => s.fetchMe);
  const root = useRef(null);

  const { contextSafe } = useGSAP(() => {
    if (reducedMotion()) return;
    const q = gsap.utils.selector(root);
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(q("[data-door]"), { y: 40, rotateX: 18, autoAlpha: 0, duration: 1.4, transformPerspective: 1200 })
      .from(q("[data-frame]"), { strokeDashoffset: 1200, duration: 2.2, ease: "power2.inOut" }, 0.1)
      .from(q("[data-sill]"), { scaleX: 0, duration: 1.2 }, 0.5)
      .from(q("[data-leak]"), { scaleX: 0.2, autoAlpha: 0, duration: 1.6 }, 0.7)
      .from(q("[data-keyhole]"), { scale: 0, duration: 0.9, ease: "back.out(2)" }, 0.9)
      .from(q("[data-copy] > *"), { y: 22, autoAlpha: 0, duration: 1, stagger: 0.08 }, 0.35);
    // The light under the door breathes, like a lamp left on in the next room.
    gsap.to(q("[data-leak]"), { opacity: 0.55, duration: 2.4, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2 });
    gsap.to(q("[data-keyglow]"), { scale: 1.35, opacity: 0.25, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }, { scope: root });

  const rattle = contextSafe(() => {
    if (reducedMotion()) return;
    const q = gsap.utils.selector(root);
    gsap.timeline()
      .to(q("[data-door]"), { keyframes: { x: [0, -10, 9, -6, 4, 0] }, duration: 0.5, ease: "power2.out" })
      .to(q("[data-keyhole]"), { color: "rgb(var(--color-danger))", duration: 0.12 }, 0)
      .to(q("[data-keyhole]"), { clearProps: "color", duration: 0.6 }, 0.6);
  });

  const swingOpen = contextSafe(() => {
    if (reducedMotion()) return;
    const q = gsap.utils.selector(root);
    gsap.timeline({ defaults: { ease: "power3.inOut" } })
      .to(q("[data-keyhole]"), { scale: 0, autoAlpha: 0, duration: 0.3 })
      .to(q("[data-leaf='l']"), { rotateY: -105, duration: 1.1 }, 0.15)
      .to(q("[data-leaf='r']"), { rotateY: 105, duration: 1.1 }, 0.15)
      .to(q("[data-flood]"), { autoAlpha: 1, scale: 1, duration: 1.2, ease: "expo.out" }, 0.3)
      .to(q("[data-leak]"), { scaleX: 1.6, opacity: 1, duration: 0.8 }, 0.2);
  });

  const redeem = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await core.redeem(code.trim());
      setOk(true);
      swingOpen();
      setTimeout(() => fetchMe(), 800);
    } catch (e2) {
      setErr(e2?.response?.data?.error || "Could not redeem that code.");
      setBusy(false);
      rattle();
    }
  };

  return (
    <div ref={root} className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-8">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        {/* The door */}
        <div className="flex justify-center">
          <div data-door className="relative w-[13.5rem] sm:w-[17rem]">
            {/* Light flooding through once the door opens */}
            <div
              data-flood
              aria-hidden="true"
              className="pointer-events-none invisible absolute -inset-16 scale-75 rounded-full opacity-0 blur-2xl [background:radial-gradient(closest-side,rgb(var(--lamp)/0.55),rgb(var(--lamp)/0.12)_60%,transparent)]"
            />
            <div className="relative aspect-[3/5] [perspective:1400px]">
              {/* Room behind the door */}
              <div className="absolute inset-[10px] overflow-hidden rounded-t-full bg-[radial-gradient(ellipse_at_50%_85%,rgb(var(--lamp)/0.9),rgb(var(--lamp)/0.25)_45%,rgb(var(--color-obsidian))_80%)]" />
              {/* Leaves */}
              <div className="absolute inset-[10px] overflow-hidden rounded-t-full [transform-style:preserve-3d]">
                {["l", "r"].map((side) => (
                  <div
                    key={side}
                    data-leaf={side}
                    className={`absolute inset-y-0 w-1/2 border-[rgb(var(--rule))] bg-[linear-gradient(180deg,rgb(var(--color-surface)),rgb(var(--color-obsidian)))] [backface-visibility:hidden] ${
                      side === "l" ? "left-0 origin-left border-r" : "right-0 origin-right border-l"
                    }`}
                  >
                    <div className={`absolute inset-x-4 top-[30%] h-[22%] rounded-lg border border-[rgb(var(--rule))] ${side === "l" ? "ml-1" : "mr-1"}`} />
                    <div className={`absolute inset-x-4 bottom-[8%] h-[28%] rounded-lg border border-[rgb(var(--rule))] ${side === "l" ? "ml-1" : "mr-1"}`} />
                  </div>
                ))}
              </div>
              {/* Arched frame, drawn on mount */}
              <svg viewBox="0 0 300 500" fill="none" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
                <path
                  data-frame
                  d="M5 498 V150 A145 145 0 0 1 295 150 V498"
                  stroke="rgb(var(--lamp))"
                  strokeOpacity="0.7"
                  strokeWidth="3"
                  strokeDasharray="1200"
                  strokeLinecap="round"
                />
                {/* The signature curve, engraved over the lintel */}
                <path d="M40 92 C 70 140, 130 152, 262 154" stroke="rgb(var(--violet))" strokeOpacity="0.55" strokeWidth="1.5" />
                <line x1="40" y1="160" x2="262" y2="160" stroke="rgb(var(--rule))" strokeDasharray="3 5" />
              </svg>
              {/* Keyhole on the seam */}
              <div data-keyhole className="absolute left-1/2 top-[56%] -translate-x-1/2 text-primary">
                <span data-keyglow aria-hidden="true" className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current opacity-40 blur-xl" />
                <svg viewBox="0 0 20 34" className="relative h-9 w-5" aria-hidden="true">
                  <circle cx="10" cy="9" r="7" fill="currentColor" />
                  <path d="M6 13 L4 32 H16 L14 13 Z" fill="currentColor" />
                </svg>
              </div>
            </div>
            {/* Sill and the lamplight leaking under the door */}
            <div data-sill className="h-px w-full bg-[rgb(var(--lamp)/0.7)]" />
            <div
              data-leak
              aria-hidden="true"
              className="mx-auto h-10 w-[120%] -translate-x-[8%] origin-top [background:radial-gradient(ellipse_at_50%_0%,rgb(var(--lamp)/0.6),transparent_70%)]"
            />
          </div>
        </div>

        {/* The words and the lock */}
        <div data-copy className="mx-auto w-full max-w-md text-center lg:mx-0 lg:text-left">
          <p className="text-sm font-medium text-primary">Club Asymptotes</p>
          <h1 className="lamp-display mt-3 text-[2.5rem] leading-[1.02] text-text-primary sm:text-5xl">
            Core Team Portal
          </h1>
          <p className="mt-4 text-base leading-7 text-text-muted">
            This workspace is for the club&apos;s council, team heads and core members.
            Enter the private access code you were given to unlock it.
          </p>

          <AnimatePresence mode="wait">
            {ok ? (
              <motion.div
                key="ok"
                role="status"
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="mt-8 flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
                  <Check className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <p className="text-sm text-success">Code accepted — opening the portal…</p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={redeem} exit={{ opacity: 0, y: -8 }} className="mt-8 space-y-3 text-left">
                <label htmlFor="core-access-code" className="block text-[13px] font-medium text-text-muted">
                  Access code
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="core-access-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ASYM-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(err)}
                    className={`w-full rounded-2xl border bg-surface/70 py-4 pl-12 pr-4 font-mono text-lg tracking-[0.3em] text-text-primary outline-none backdrop-blur transition placeholder:text-text-dim focus:shadow-[0_0_0_4px_rgb(var(--lamp)/0.12)] ${
                      err ? "border-danger/50" : "border-[rgb(var(--rule))] focus:border-primary/60"
                    }`}
                  />
                </div>
                <AnimatePresence>
                  {err && (
                    <motion.p
                      key={err}
                      role="alert"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger"
                    >
                      {err}
                    </motion.p>
                  )}
                </AnimatePresence>
                <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full" magnetic={false}>
                  Unlock Portal
                </Button>
                <p className="pt-1 text-center text-[13px] text-text-dim lg:text-left">
                  Don&apos;t have a code? Contact the club council.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
