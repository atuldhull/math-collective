import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { AlertCircle, Radio } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import { TiltPanel } from "@/components/lamp";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import LiveStage from "./LiveStage";

const PHASE_ERROR = "error";
const CODE_SLOTS = 6;

export default function JoinScreen({ code, setCode, playerName, setPlayerName, joining, phase, errorMsg, onJoin }) {
  const root = useRef(null);
  const filled = Math.min(code.length, CODE_SLOTS);
  const hasError = phase === PHASE_ERROR && errorMsg;

  // Opening beat: the card swings up off the floor, the title rises
  // word by word and the six code slots switch on left to right.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.timeline({ defaults: { ease: "expo.out" } })
        .from(q("[data-card]"), { rotateX: 24, y: 60, autoAlpha: 0, transformPerspective: 1100, transformOrigin: "50% 100%", duration: 1.2 })
        .from(q("[data-live]"), { scale: 0, duration: 0.6, ease: "back.out(3)" }, 0.3)
        .from(q("[data-word]"), { yPercent: 110, duration: 0.9, stagger: 0.08 }, 0.25)
        .from(q("[data-slot]"), { scaleY: 0, transformOrigin: "50% 100%", duration: 0.5, stagger: 0.05 }, 0.5)
        .from(q("[data-field]"), { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.08 }, 0.45);
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <LiveStage tone={hasError ? "bad" : "lamp"} center>
      <div ref={root} className="w-full max-w-md">
        <TiltPanel lit data-card className="p-6 sm:p-8">
          <div className="relative text-center">
            <span data-live className="inline-flex items-center gap-2 rounded-full border border-danger/30 bg-danger/10 px-3 py-1 text-[13px] font-medium text-danger">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-70 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
              </span>
              Battle mode
            </span>
            <h1 className="lamp-display mt-4 text-[2.6rem] leading-none text-text-primary sm:text-5xl">
              <span className="lamp-word"><span data-word>Live&nbsp;</span></span>
              <span className="lamp-word"><span data-word>quiz</span></span>
            </h1>
            <p className="mt-3 text-sm text-text-muted">
              Enter the code from your teacher to join the session.
            </p>
          </div>

          <div className="relative mt-8 space-y-5">
            <div data-field>
              <InputField
                label="Quiz Code"
                placeholder="e.g. AB3X9K"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                inputClassName="text-center font-mono text-xl tracking-[0.3em] uppercase"
                autoComplete="off"
                spellCheck={false}
              />
              {/* Six slots light up as the code is typed. */}
              <div aria-hidden="true" className="mt-3 flex justify-center gap-1.5">
                {Array.from({ length: CODE_SLOTS }).map((_, i) => (
                  <span
                    key={i}
                    data-slot
                    className={cn(
                      "h-1.5 w-8 rounded-full transition-all duration-300",
                      i < filled
                        ? "bg-primary shadow-[0_0_10px_rgb(var(--lamp)/0.7)]"
                        : "bg-[rgb(var(--rule))]",
                    )}
                  />
                ))}
              </div>
            </div>

            <div data-field>
              <InputField
                label="Your Name"
                placeholder="Enter your display name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>

            <AnimatePresence>
              {hasError && (
                <motion.p
                  key="err"
                  role="alert"
                  initial={{ opacity: 0, y: -8, x: 0 }}
                  animate={{ opacity: 1, y: 0, x: [0, -8, 8, -5, 5, 0] }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.5 }}
                  className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  {errorMsg}
                </motion.p>
              )}
            </AnimatePresence>

            <div data-field>
              <Button
                size="lg"
                className="w-full justify-center"
                loading={joining}
                onClick={onJoin}
                leading={<Radio className="h-4 w-4" strokeWidth={1.75} />}
              >
                Join session
              </Button>
            </div>
          </div>
        </TiltPanel>
      </div>
    </LiveStage>
  );
}
