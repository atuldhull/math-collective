import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { Crown, RotateCcw } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import Button from "@/components/ui/Button";
import LiveStage from "./LiveStage";

// Podium blocks, left to right: 2nd, 1st, 3rd.
const STEPS = [
  { place: 1, label: "2nd", height: "h-24 sm:h-32", avatar: "h-12 w-12 text-lg", block: "border-text-primary/25 bg-[linear-gradient(180deg,rgb(var(--color-text-primary)/0.12),rgb(var(--color-text-primary)/0.02))]", ring: "border-text-primary/40 bg-panel text-text-primary", score: "text-text-primary" },
  { place: 0, label: "1st", height: "h-36 sm:h-48", avatar: "h-16 w-16 text-2xl", block: "border-[rgb(var(--lamp)/0.45)] bg-[linear-gradient(180deg,rgb(var(--lamp)/0.28),rgb(var(--lamp)/0.04))] shadow-[0_-20px_60px_-20px_rgb(var(--lamp)/0.6)]", ring: "border-primary bg-primary/15 text-primary shadow-[0_0_30px_-4px_rgb(var(--lamp)/0.7)]", score: "text-primary" },
  { place: 2, label: "3rd", height: "h-16 sm:h-24", avatar: "h-12 w-12 text-lg", block: "border-secondary/35 bg-[linear-gradient(180deg,rgb(var(--violet)/0.22),rgb(var(--violet)/0.03))]", ring: "border-secondary/50 bg-panel text-secondary", score: "text-secondary" },
];

const CONFETTI = 28;

export default function FinishedScreen({ leaderboard, playerName, onLeave }) {
  const root = useRef(null);
  const podium = STEPS.filter((s) => leaderboard[s.place]);

  // The finale: the title rises, the podium is built from the ground up
  // (3rd, then 2nd, then 1st), each player drops onto their step, the
  // crown lands on the winner and confetti goes up. Then the full table
  // slides in underneath.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(q("[data-title-word]"), { yPercent: 115, rotate: 4, duration: 1.1, stagger: 0.08 })
        .from(q("[data-sub]"), { y: 14, autoAlpha: 0, duration: 0.7 }, 0.2);

      ["2", "1", "0"].forEach((place, i) => {
        const at = 0.45 + i * 0.35;
        tl.from(q(`[data-step="${place}"] [data-block]`), { scaleY: 0, transformOrigin: "50% 100%", duration: 0.9, ease: "power4.out" }, at)
          .from(q(`[data-step="${place}"] [data-player]`), { y: -140, autoAlpha: 0, duration: 0.8, ease: "bounce.out" }, at + 0.25);
      });

      tl.from(q("[data-crown]"), { y: -60, rotate: -30, scale: 0.4, autoAlpha: 0, duration: 0.9, ease: "back.out(3)" }, ">-0.2")
        .addLabel("party", "<");

      q("[data-confetti]").forEach((c) => {
        tl.fromTo(c,
          { x: 0, y: 0, rotate: 0, autoAlpha: 1 },
          {
            x: gsap.utils.random(-220, 220),
            y: gsap.utils.random(-260, -90),
            rotate: gsap.utils.random(-540, 540),
            autoAlpha: 0,
            duration: gsap.utils.random(1.4, 2.2),
            ease: "power3.out",
          }, `party+=${gsap.utils.random(0, 0.15)}`);
      });

      tl.from(q("[data-board-row]"), { x: -30, autoAlpha: 0, duration: 0.6, stagger: 0.06 }, "party")
        .from(q("[data-again]"), { y: 20, autoAlpha: 0, scale: 0.9, duration: 0.7, ease: "back.out(2)" }, "<0.3");
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <LiveStage tone="lamp">
      <div ref={root} className="mx-auto max-w-3xl space-y-10">
        <section className="pt-4 text-center">
          <p data-sub className="text-[13px] font-medium text-primary">Final results</p>
          <h1 className="lamp-display mt-3 text-5xl leading-none text-text-primary sm:text-6xl">
            <span className="lamp-word"><span data-title-word>Quiz&nbsp;</span></span>
            <span className="lamp-word"><span data-title-word>complete!</span></span>
          </h1>
        </section>

        {/* Podium */}
        {podium.length > 0 && (
          <section aria-label="Podium" className="relative mx-auto flex max-w-xl items-end justify-center gap-2 sm:gap-4">
            {podium.map((step) => {
              const entry = leaderboard[step.place];
              const isMe = entry.name === playerName;
              const first = step.place === 0;
              return (
                <div key={step.place} data-step={step.place} className={cn("relative flex flex-col items-center", first ? "w-[38%] max-w-[11rem]" : "w-[31%] max-w-[9rem]")}>
                  <div data-player className="relative flex flex-col items-center">
                    {first && (
                      <>
                        <Crown data-crown className="mb-1 h-8 w-8 text-primary drop-shadow-[0_0_10px_rgb(var(--lamp)/0.8)]" strokeWidth={1.75} aria-hidden="true" />
                        {Array.from({ length: CONFETTI }).map((_, i) => (
                          <span
                            key={i}
                            data-confetti
                            aria-hidden="true"
                            className={cn(
                              "pointer-events-none absolute left-1/2 top-6 h-2.5 w-1.5 rounded-[2px] opacity-0",
                              ["bg-primary", "bg-secondary", "bg-success", "bg-text-primary"][i % 4],
                            )}
                          />
                        ))}
                      </>
                    )}
                    <span className={cn("flex items-center justify-center rounded-full border-2 font-semibold", step.avatar, step.ring)}>
                      {entry.name.charAt(0).toUpperCase()}
                    </span>
                    <p className={cn("mt-2 max-w-full truncate px-1 text-sm", first ? "font-semibold text-text-primary" : "font-medium text-text-muted")}>
                      {entry.name}
                      {isMe && <span className="sr-only"> (you)</span>}
                    </p>
                    <p className={cn("lamp-numerals mt-0.5", first ? "text-2xl" : "text-lg", step.score)}>
                      <AnimatedNumber value={entry.score} duration={1.8} />
                    </p>
                  </div>
                  <div
                    data-block
                    className={cn(
                      "mt-3 flex w-full items-start justify-center rounded-t-2xl border border-b-0 pt-3",
                      step.height,
                      step.block,
                      isMe && "ring-2 ring-primary/40",
                    )}
                  >
                    <span className={cn("lamp-display", first ? "text-3xl text-primary" : "text-xl text-text-muted")}>{step.label}</span>
                  </div>
                </div>
              );
            })}
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgb(var(--lamp)/0.6),transparent)]" />
          </section>
        )}

        {/* Full leaderboard */}
        <section className="lamp-panel mx-auto max-w-xl p-5 sm:p-7">
          <h2 className="text-lg text-text-primary">Full leaderboard</h2>
          <ol className="mt-4 space-y-2">
            {leaderboard.map((entry) => {
              const isMe = entry.name === playerName;
              return (
                <li
                  key={entry.rank}
                  data-board-row
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3",
                    entry.rank === 1 ? "border-[rgb(var(--lamp)/0.35)] bg-[rgb(var(--lamp)/0.08)]" : "border-[rgb(var(--rule))] bg-surface/40",
                    isMe && "ring-1 ring-primary/40",
                  )}
                >
                  <span className={cn("lamp-numerals w-7 shrink-0 text-sm", entry.rank === 1 ? "text-primary" : entry.rank <= 3 ? "text-text-primary" : "text-text-dim")}>
                    {entry.rank}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", isMe ? "text-text-primary" : "text-text-muted")}>
                    {entry.name}
                    {isMe && (
                      <span className="ml-2 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[12px] text-primary">
                        You
                      </span>
                    )}
                  </span>
                  <span className="lamp-numerals shrink-0 text-sm text-text-primary">
                    {entry.score} pts
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <div data-again className="text-center">
          <Button size="lg" onClick={onLeave} leading={<RotateCcw className="h-4 w-4" strokeWidth={1.75} />}>
            Play again
          </Button>
        </div>
      </div>
    </LiveStage>
  );
}
