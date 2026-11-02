import { useRef } from "react";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { Check, Clock3, Lightbulb, X } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import MathRender from "@/components/math/MathRender";
import Loader from "@/components/ui/Loader";
import LiveStage from "./LiveStage";

const PARTICLES = 18;

function rankTone(rank) {
  if (rank === 1) return "bg-primary text-[rgb(var(--color-obsidian))]";
  if (rank === 2) return "bg-text-primary/80 text-[rgb(var(--color-obsidian))]";
  if (rank === 3) return "bg-secondary/80 text-text-primary";
  return "bg-white/[0.05] text-text-dim";
}

export default function ResultScreen({ result, question, selectedAnswer, playerName }) {
  const wasCorrect = selectedAnswer === result.correctIndex;
  const didNotAnswer = selectedAnswer === null;
  const root = useRef(null);

  const verdict = didNotAnswer
    ? { tone: "warn", icon: Clock3, ring: "border-warning/50 bg-warning/15 text-warning", title: "No answer", titleClass: "text-warning", body: "You did not answer this question." }
    : wasCorrect
      ? { tone: "good", icon: Check, ring: "border-success/50 bg-success/15 text-success", title: "Correct!", titleClass: "text-success", body: "Great job, keep it going!" }
      : { tone: "bad", icon: X, ring: "border-danger/50 bg-danger/15 text-danger", title: "Wrong", titleClass: "text-danger", body: "The correct answer is highlighted below." };
  const VerdictIcon = verdict.icon;
  const topScore = Math.max(1, ...(result.podium || []).map((p) => p.score || 0));

  // The verdict lands: a correct answer bursts outward in sparks and a
  // shock ring; a miss slams in and shakes, shedding a few red shards.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(q("[data-badge]"), { scale: wasCorrect ? 0 : 2.2, rotate: wasCorrect ? -45 : 0, autoAlpha: 0, duration: 0.8, ease: wasCorrect ? "back.out(2.6)" : "power4.in" })
        .from(q("[data-verdict]"), { yPercent: 110, duration: 0.9 }, 0.2)
        .from(q("[data-verdict-body]"), { y: 12, autoAlpha: 0, duration: 0.7 }, 0.35);

      const sparks = q("[data-spark]");
      if (!didNotAnswer && sparks.length) {
        sparks.forEach((s, i) => {
          const angle = (i / sparks.length) * Math.PI * 2 + gsap.utils.random(-0.15, 0.15);
          const dist = wasCorrect ? gsap.utils.random(80, 150) : gsap.utils.random(40, 80);
          tl.fromTo(s,
            { x: 0, y: 0, scale: 1, autoAlpha: 1 },
            {
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist + (wasCorrect ? 0 : 60),
              scale: 0, autoAlpha: 0, duration: wasCorrect ? 1.1 : 0.9, ease: wasCorrect ? "expo.out" : "power2.in",
            }, wasCorrect ? 0.3 : 0.55);
        });
        tl.fromTo(q("[data-shock]"), { scale: 0.6, autoAlpha: 0.9 }, { scale: 2.4, autoAlpha: 0, duration: 1 }, wasCorrect ? 0.3 : 0.55);
      }
      if (!wasCorrect && !didNotAnswer) {
        tl.to(q("[data-badge]"), { keyframes: { x: [0, -14, 12, -8, 6, 0] }, duration: 0.5, ease: "none" }, 0.62);
      }
      // GSAP interpolates concrete colours only, so read the theme's
      // success triplet now rather than tweening a var() expression.
      const ok = window.getComputedStyle(root.current).getPropertyValue("--color-success").trim() || "126 222 174";
      tl.from(q("[data-reveal-row]"), { x: -24, autoAlpha: 0, duration: 0.6, stagger: 0.07 }, 0.5)
        .to(q("[data-correct-row]"), { boxShadow: `0 0 0 2px rgb(${ok} / 0.45), 0 12px 40px -12px rgb(${ok} / 0.6)`, duration: 0.5, yoyo: true, repeat: 1, ease: "sine.inOut", clearProps: "boxShadow" }, ">")
        .from(q("[data-podium-row]"), { y: 20, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, 0.8)
        .from(q("[data-score-bar]"), { scaleX: 0, transformOrigin: "left center", duration: 1.1, stagger: 0.08 }, 0.95);
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <LiveStage tone={verdict.tone}>
      <div ref={root} className="mx-auto max-w-3xl space-y-8">
        {/* Verdict */}
        <div className="flex flex-col items-center pt-4 text-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <span data-shock aria-hidden="true" className={cn("absolute inset-0 rounded-full border-2 opacity-0", verdict.ring)} />
            {Array.from({ length: didNotAnswer ? 0 : PARTICLES }).map((_, i) => (
              <span
                key={i}
                data-spark
                aria-hidden="true"
                className={cn(
                  "absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 opacity-0",
                  wasCorrect
                    ? i % 3 === 0 ? "rounded-full bg-primary" : "rounded-full bg-success"
                    : "rotate-45 bg-danger",
                )}
              />
            ))}
            <span data-badge className={cn("relative flex h-24 w-24 items-center justify-center rounded-full border-2", verdict.ring)}>
              <VerdictIcon className="h-11 w-11" strokeWidth={2.25} aria-hidden="true" />
            </span>
          </div>
          <h2 className="mt-5 overflow-hidden pb-1">
            <span data-verdict className={cn("lamp-display block text-5xl sm:text-6xl", verdict.titleClass)}>
              {verdict.title}
            </span>
          </h2>
          <p data-verdict-body className="mt-2 text-sm text-text-muted">{verdict.body}</p>
        </div>

        {/* Answer reveal */}
        {question && (
          <section className="lamp-panel p-5 sm:p-7">
            <p className="text-[13px] font-medium text-primary">
              Question {question.questionNumber}
            </p>
            <div className="overflow-x-auto">
              <MathRender
                source={String(question.question || "")}
                className="mt-2 break-words text-lg font-semibold text-text-primary [&_.katex]:text-text-primary"
              />
            </div>

            <ul className="mt-5 space-y-2">
              {(question.options || []).map((opt, oi) => {
                const isCorrect = oi === result.correctIndex;
                const isYours = oi === selectedAnswer;
                const optText = typeof opt === "string" ? opt : opt.text || opt.label;

                return (
                  <li
                    key={oi}
                    data-reveal-row
                    data-correct-row={isCorrect ? "" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3",
                      isCorrect
                        ? "border-success/35 bg-success/10"
                        : isYours
                          ? "border-danger/35 bg-danger/10"
                          : "border-[rgb(var(--rule))] bg-surface/30",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isCorrect
                          ? "bg-success/20 text-success"
                          : isYours
                            ? "bg-danger/20 text-danger"
                            : "bg-white/[0.05] font-mono text-text-dim",
                      )}
                    >
                      {isCorrect
                        ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-label="Correct answer" />
                        : isYours
                          ? <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-label="Your answer" />
                          : String.fromCharCode(65 + oi)}
                    </span>
                    <MathRender
                      source={String(optText || "")}
                      className={cn("min-w-0 text-sm", isCorrect ? "font-medium text-text-primary [&_.katex]:text-text-primary" : "text-text-muted [&_.katex]:text-text-muted")}
                    />
                    {isYours && (
                      <span className="ml-auto shrink-0 text-[12px] text-text-dim">
                        Your pick
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {result.solution && (
              <div className="mt-5 flex gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <p className="text-[13px] font-medium text-primary">Solution</p>
                  <p className="mt-1 text-sm leading-7 text-text-muted">{result.solution}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Standings so far */}
        {result.podium && result.podium.length > 0 && (
          <section className="lamp-panel p-5 sm:p-7">
            <h3 className="text-lg text-text-primary">Top players</h3>
            <ul className="mt-4 space-y-3">
              {result.podium.map((p) => {
                const isMe = p.name === playerName;
                return (
                  <li key={p.rank} data-podium-row className={cn("rounded-xl px-1 py-1", isMe && "bg-[rgb(var(--lamp)/0.06)] ring-1 ring-primary/30")}>
                    <div className="flex items-center gap-3 px-2">
                      <span className={cn("lamp-numerals flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm", rankTone(p.rank))}>
                        {p.rank}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", isMe ? "text-text-primary" : "text-text-muted")}>
                        {p.name}
                        {isMe && <span className="ml-2 text-[12px] text-primary">You</span>}
                      </span>
                      <span className="lamp-numerals text-sm text-text-primary">{p.score}</span>
                    </div>
                    <div className="ml-12 mr-2 mt-1.5 h-1 overflow-hidden rounded-full bg-[rgb(var(--rule))]">
                      <div
                        data-score-bar
                        className={cn("h-full rounded-full", p.rank === 1 ? "bg-primary" : "bg-secondary/70")}
                        style={{ width: `${((p.score || 0) / topScore) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Waiting for next question */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center"
        >
          <Loader variant="dots" label={result.isLast ? "Final results incoming..." : "Next question starting soon..."} />
        </motion.div>
      </div>
    </LiveStage>
  );
}
