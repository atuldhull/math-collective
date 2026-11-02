import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { Check, Hourglass, Lock } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import MathRender from "@/components/math/MathRender";
import LiveStage from "./LiveStage";

const optionLetters = "ABCDEFGH";

// Countdown ring geometry (viewBox 0 0 200 200).
const R = 84;
const C = 2 * Math.PI * R;
const TICKS = 60;

function urgency(timerPercent) {
  if (timerPercent > 50) return { stroke: "rgb(var(--lamp))", text: "text-primary", tone: "lamp" };
  if (timerPercent > 25) return { stroke: "rgb(var(--color-warning))", text: "text-warning", tone: "warn" };
  return { stroke: "rgb(var(--color-danger))", text: "text-danger", tone: "bad" };
}

export default function QuestionScreen({
  question,
  selectedAnswer,
  answerSubmitted,
  timeLeft,
  timerPercent,
  timerColor,
  onSubmitAnswer,
}) {
  const root = useRef(null);
  const u = urgency(timerPercent);
  const finalSeconds = timeLeft > 0 && timeLeft <= 5;

  // Each new question: the gauge ticks fan in around the dial, the ring
  // draws itself full, the question rises and the options pop in one by
  // one from below with a little spin.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.timeline({ defaults: { ease: "expo.out" } })
        .from(q("[data-tick]"), { autoAlpha: 0, duration: 0.4, stagger: { each: 0.012, from: "start" } })
        .from(q("[data-dial]"), { scale: 0.6, autoAlpha: 0, rotate: -90, duration: 1.1, ease: "back.out(1.6)" }, 0)
        .from(q("[data-qtext]"), { y: 30, autoAlpha: 0, duration: 0.9 }, 0.25)
        .from(q("[data-option]"), {
          y: 40, scale: 0.7, rotateX: -50, autoAlpha: 0, transformPerspective: 800,
          duration: 0.7, ease: "back.out(1.8)", stagger: 0.09, clearProps: "transform,opacity,visibility",
        }, 0.45);
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [question.questionNumber], revertOnUpdate: true });

  // The moment of choosing: the picked card throws a ring of lamp
  // light outward.
  const { contextSafe } = useGSAP({ scope: root });
  const pick = contextSafe((oi, el) => {
    onSubmitAnswer(oi);
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ring = el.querySelector("[data-pulse]");
    gsap.fromTo(ring, { autoAlpha: 0.9, scale: 1 }, { autoAlpha: 0, scale: 1.12, duration: 0.7, ease: "expo.out" });
  });

  return (
    <LiveStage tone={u.tone}>
      <div ref={root} className="space-y-6">
        {/* Header: progress on the left, points on the right, dial in the middle */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <p className="text-[13px] font-medium text-danger">Live quiz</p>
            <p className="mt-1 text-sm text-text-muted">
              Question{" "}
              <span className="lamp-numerals text-lg text-text-primary">{question.questionNumber}</span>
              {" of "}
              <span className="lamp-numerals text-text-primary">{question.total}</span>
            </p>
          </div>

          {/* Countdown dial */}
          <div
            data-dial
            role="timer"
            aria-label={`${timeLeft} seconds left`}
            className="relative h-28 w-28 sm:h-40 sm:w-40"
          >
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
              {Array.from({ length: TICKS }).map((_, i) => {
                const lit = i / TICKS < timerPercent / 100;
                return (
                  <line
                    key={i}
                    data-tick
                    x1="100" y1="4" x2="100" y2={i % 5 === 0 ? 14 : 10}
                    transform={`rotate(${(i / TICKS) * 360} 100 100)`}
                    stroke={lit ? u.stroke : "rgb(var(--rule))"}
                    strokeWidth={i % 5 === 0 ? 2 : 1.2}
                    strokeLinecap="round"
                    style={{ transition: "stroke 0.4s" }}
                  />
                );
              })}
              <circle cx="100" cy="100" r={R} fill="none" stroke="rgb(var(--rule))" strokeWidth="8" />
              <motion.circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={u.stroke}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={C}
                initial={{ strokeDashoffset: C }}
                animate={{ strokeDashoffset: C * (1 - timerPercent / 100) }}
                transition={{ duration: 1, ease: "linear" }}
                style={{ filter: `drop-shadow(0 0 8px ${u.stroke})`, transition: "stroke 0.4s" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={timeLeft}
                  initial={{ scale: finalSeconds ? 1.7 : 1.25, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 26 }}
                  className={cn("lamp-numerals text-4xl leading-none sm:text-5xl", u.text)}
                >
                  {timeLeft}
                </motion.span>
              </AnimatePresence>
              <span className="mt-1 text-[11px] text-text-dim sm:text-xs">seconds</span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[13px] text-text-dim">Points</p>
            <p className="lamp-numerals text-2xl text-primary sm:text-3xl">
              {question.points || 50}
            </p>
          </div>
        </div>

        {/* Timer bar */}
        <div className="h-1 overflow-hidden rounded-full bg-[rgb(var(--rule))]">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${timerColor}`}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.8, ease: "linear" }}
          />
        </div>

        {/* Question card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={question.questionNumber}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="lamp-panel p-5 sm:p-8"
          >
            <div data-qtext>
              {question.title && (
                <p className="text-[13px] font-medium text-primary">
                  {question.title}
                </p>
              )}
              {/* MathRender so questions authored with $...$ / $$...$$
                  delimiters render as actual maths instead of raw LaTeX
                  source. Plain-text questions pass through unchanged. */}
              <div className="overflow-x-auto">
                <MathRender
                  source={String(question.question || "")}
                  className="lamp-display mt-3 text-xl leading-8 text-text-primary sm:text-[1.75rem] sm:leading-10 [&_.katex]:text-text-primary"
                />
              </div>
            </div>

            {/* Options */}
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {(question.options || []).map((option, oi) => {
                const isSelected = selectedAnswer === oi;
                const isLocked = answerSubmitted;

                return (
                  <motion.button
                    key={oi}
                    type="button"
                    data-option
                    whileHover={isLocked ? undefined : { y: -3 }}
                    whileTap={isLocked ? undefined : { scale: 0.97 }}
                    onClick={(e) => !isLocked && pick(oi, e.currentTarget)}
                    disabled={isLocked}
                    className={cn(
                      "group relative min-h-[64px] w-full rounded-2xl border px-4 py-4 text-left transition-colors duration-200 sm:px-5",
                      isSelected
                        ? "border-[rgb(var(--lamp)/0.6)] bg-[rgb(var(--lamp)/0.12)] shadow-[0_14px_40px_-14px_rgb(var(--lamp)/0.7)]"
                        : isLocked
                          ? "border-[rgb(var(--rule))] bg-surface/30 opacity-45"
                          : "border-[rgb(var(--rule))] bg-surface/60 hover:border-[rgb(var(--lamp)/0.4)] hover:bg-[rgb(var(--lamp)/0.05)]",
                      isLocked && !isSelected && "pointer-events-none",
                    )}
                  >
                    <span data-pulse aria-hidden="true" className="pointer-events-none absolute -inset-px rounded-2xl border-2 border-primary opacity-0" />
                    <div className="flex items-center gap-3 pr-16">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-mono text-sm font-semibold transition-colors",
                          isSelected
                            ? "border-transparent bg-primary text-[rgb(var(--color-obsidian))]"
                            : "border-[rgb(var(--rule))] bg-panel text-text-muted group-hover:text-primary",
                        )}
                      >
                        {optionLetters[oi]}
                      </span>
                      <MathRender
                        source={String(typeof option === "string" ? option : (option.text || option.label || ""))}
                        className={cn(
                          "min-w-0 overflow-x-auto text-[15px] font-medium",
                          isSelected ? "text-text-primary [&_.katex]:text-text-primary" : "text-text-muted [&_.katex]:text-text-muted",
                        )}
                      />
                    </div>
                    {isSelected && answerSubmitted && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0, rotate: -30 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 18 }}
                        className="absolute right-4 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 text-[13px] font-medium text-primary"
                      >
                        <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                        Locked
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {answerSubmitted && (
                <motion.div
                  key="submitted"
                  role="status"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-3"
                >
                  <Check className="h-4 w-4 text-success" strokeWidth={2} aria-hidden="true" />
                  <p className="text-sm font-medium text-success">
                    Answer submitted. Waiting for results...
                  </p>
                </motion.div>
              )}

              {timeLeft === 0 && !answerSubmitted && (
                <motion.div
                  key="timeout"
                  role="status"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3"
                >
                  <Hourglass className="h-4 w-4 text-warning" strokeWidth={1.75} aria-hidden="true" />
                  <p className="text-sm font-medium text-warning">
                    Time is up. Waiting for results...
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </LiveStage>
  );
}
