import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { Check, Crown, Play, Radio, SkipForward, Square, Users } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import LiveAIPanel from "./LiveAIPanel";

const STATUS_LABEL = {
  idle: "Idle",
  lobby: "Lobby open",
  question: "Question live",
  results: "Showing results",
  finished: "Finished",
};

function difficultyTone(d) {
  const v = (d || "").toLowerCase();
  if (v === "hard") return "text-danger";
  if (v === "extreme") return "text-glow";
  if (v === "easy") return "text-success";
  return "text-warning";
}

/** Quiz code, one character per slot; the slots flip over like a departures board. */
function CodeBoard({ code }) {
  const ref = useRef(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(ref.current.querySelectorAll("[data-slot]"), {
        rotateX: -90, autoAlpha: 0, y: -12, duration: 0.8, ease: "back.out(1.8)", stagger: 0.08,
      });
    });
    return () => mm.revert();
  }, { scope: ref, dependencies: [code], revertOnUpdate: true });

  return (
    <div ref={ref} className="flex justify-center gap-1.5 [perspective:600px] sm:gap-2" aria-label={`Quiz code ${code}`}>
      {String(code).split("").map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          data-slot
          aria-hidden="true"
          className="lamp-numerals flex h-14 w-10 items-center justify-center rounded-xl border border-primary/30 bg-[linear-gradient(180deg,rgb(var(--lamp)/0.16),rgb(var(--lamp)/0.04))] text-3xl text-primary shadow-[inset_0_-1px_0_rgb(var(--lamp)/0.25)] sm:h-20 sm:w-14 sm:text-5xl"
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

export default function LiveQuizHost({
  // State
  liveActive,
  liveCode,
  livePlayers,
  liveStatus,
  liveQuestionNum,
  liveTotalQ,
  liveAnswered,
  livePodium,
  liveSelectedQs,
  setLiveSelectedQs,
  teacherName,
  setTeacherName,
  challengePool,
  poolLoading,
  // AI state (inline panel inside the host setup)
  aiTopics,
  setAiTopics,
  aiCount,
  setAiCount,
  aiDifficulty,
  setAiDifficulty,
  aiGenerating,
  setAiGenerating,
  aiResult,
  setAiResult,
  setChallengePool,
  setError,
  setSuccess,
  // Actions
  startLiveQuiz,
  nextQuestion,
  revealAnswer,
  endLiveQuiz,
}) {
  const answeredPct = liveAnswered.total > 0
    ? Math.min(100, Math.round((liveAnswered.answered / liveAnswered.total) * 100))
    : 0;
  const topScore = Math.max(1, ...livePodium.map((p) => Number(p.score) || 0));
  const isLive = liveStatus === "question";

  return (
    <section data-reveal="up" className="lamp-panel lamp-panel--lit p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Radio className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            {liveActive ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
              </span>
            ) : null}
          </span>
          <div>
            <h2 className="text-xl text-text-primary sm:text-2xl">Host live quiz</h2>
            <p className="text-[13px] text-text-muted">Real-time quiz — students join with a code</p>
          </div>
        </div>
        {!liveActive && liveSelectedQs.length > 0 && (
          <motion.span
            key={liveSelectedQs.length}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-full bg-primary/15 px-3 py-1 text-[13px] font-medium tabular-nums text-primary"
          >
            {liveSelectedQs.length} questions ready
          </motion.span>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {!liveActive ? (
          <motion.div
            key="setup"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 space-y-6"
          >
            <div>
              <label htmlFor="live-host-name" className="mb-1.5 block text-[13px] font-medium text-text-muted">
                Your Name
              </label>
              <input
                id="live-host-name"
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-4 py-2.5 text-sm text-text-primary outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15 sm:w-64"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Select from existing questions */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-text-muted">
                    Pick from Question Bank ({liveSelectedQs.length} selected)
                  </p>
                  {liveSelectedQs.length > 0 && (
                    <button
                      onClick={() => setLiveSelectedQs([])}
                      className="-my-1 min-h-[40px] rounded px-2 text-[13px] font-medium text-danger hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                <div className="scrollbar-thin max-h-[360px] space-y-1 overflow-y-auto rounded-2xl border border-[rgb(var(--rule))] bg-black/15 p-2">
                  {poolLoading ? (
                    <p className="py-6 text-center text-[13px] text-text-dim">Loading challenges...</p>
                  ) : (challengePool || []).length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-text-dim">
                      No challenges in the bank yet. Generate some with AI.
                    </p>
                  ) : (
                    (challengePool || []).map((c) => {
                      const on = liveSelectedQs.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                            on ? "border-primary/30 bg-primary/10" : "border-transparent hover:bg-white/[0.03]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setLiveSelectedQs((prev) =>
                                prev.includes(c.id)
                                  ? prev.filter((x) => x !== c.id)
                                  : [...prev, c.id],
                              )
                            }
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden="true"
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/60 ${
                              on ? "border-primary bg-primary text-[rgb(var(--color-obsidian))]" : "border-[rgb(var(--rule))]"
                            }`}
                          >
                            <AnimatePresence>
                              {on ? (
                                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                </motion.span>
                              ) : null}
                            </AnimatePresence>
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{c.title}</span>
                          <span className={`shrink-0 text-[12px] font-medium ${difficultyTone(c.difficulty)}`}>
                            {c.difficulty}
                          </span>
                          <span className="shrink-0 text-[12px] tabular-nums text-text-dim">{c.points}pts</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setLiveSelectedQs((challengePool || []).map((c) => c.id))}
                    className="-my-1 min-h-[40px] rounded px-2 text-[13px] font-medium text-primary hover:underline"
                  >
                    Select all
                  </button>
                </div>
              </div>

              {/* Right: AI Generate questions */}
              <LiveAIPanel
                aiTopics={aiTopics}
                setAiTopics={setAiTopics}
                aiCount={aiCount}
                setAiCount={setAiCount}
                aiDifficulty={aiDifficulty}
                setAiDifficulty={setAiDifficulty}
                aiGenerating={aiGenerating}
                setAiGenerating={setAiGenerating}
                aiResult={aiResult}
                setAiResult={setAiResult}
                setChallengePool={setChallengePool}
                setError={setError}
                setSuccess={setSuccess}
              />
            </div>

            <Button
              onClick={startLiveQuiz}
              disabled={liveSelectedQs.length === 0}
              size="lg"
              className="w-full justify-center"
              leading={<Play className="h-4 w-4" strokeWidth={1.75} />}
            >
              Start Live Quiz ({liveSelectedQs.length} questions)
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="live"
            initial={{ opacity: 0, rotateX: -10, y: 24 }}
            animate={{ opacity: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformPerspective: 1200 }}
            className="mt-6 space-y-5"
          >
            {/* Control room: code board + live gauges */}
            <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
              <div className="rounded-2xl border border-[rgb(var(--rule))] bg-black/20 px-4 py-5 sm:px-6">
                <p className="text-center text-[13px] font-medium text-text-muted">Quiz code</p>
                <div className="mt-3">
                  <CodeBoard code={liveCode} />
                </div>
                <p className="mt-3 text-center text-[12px] text-text-dim">Share this with students</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[rgb(var(--rule))] bg-black/20 p-4">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium text-text-muted">
                    <Users className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Joined
                  </p>
                  <p className="lamp-numerals mt-2 text-4xl leading-none text-text-primary sm:text-5xl" aria-live="polite">
                    <AnimatedNumber value={livePlayers.length} duration={0.6} />
                  </p>
                  <p className="mt-1.5 text-[12px] text-text-dim">
                    player{livePlayers.length !== 1 ? "s" : ""} joined
                  </p>
                </div>

                <div className="rounded-2xl border border-[rgb(var(--rule))] bg-black/20 p-4">
                  <p className="text-[13px] font-medium text-text-muted">Question</p>
                  <p className="lamp-numerals mt-2 text-4xl leading-none text-text-primary sm:text-5xl">
                    <AnimatedNumber value={liveQuestionNum} duration={0.6} />
                    <span className="text-xl text-text-dim">/{liveTotalQ}</span>
                  </p>
                  <div className="mt-3 flex gap-1" aria-hidden="true">
                    {Array.from({ length: liveTotalQ }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                          i < liveQuestionNum ? "bg-primary" : "bg-white/[0.07]"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-[rgb(var(--rule))] bg-black/20 p-4 sm:col-span-1 sm:flex-col sm:items-start">
                  <p className="text-[13px] font-medium text-text-muted">Status</p>
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium ${
                      isLive ? "bg-success/15 text-success" : liveStatus === "finished" ? "bg-white/[0.06] text-text-muted" : "bg-primary/12 text-primary"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${isLive ? "animate-pulse bg-success" : "bg-current"}`} />
                    <span className="sr-only">Status: </span>
                    {STATUS_LABEL[liveStatus] || liveStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Answer gauge */}
            <AnimatePresence>
              {isLive && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-secondary/25 bg-secondary/[0.06] p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13px] font-medium text-secondary">Answers in</p>
                      <p className="lamp-numerals text-lg text-text-primary" aria-live="polite">
                        <AnimatedNumber value={liveAnswered.answered} duration={0.5} />
                        <span className="text-text-dim">/{liveAnswered.total}</span>
                        <span className="sr-only"> answered</span>
                      </p>
                    </div>
                    <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,rgb(var(--violet)),rgb(var(--lamp)))]"
                        initial={{ width: 0 }}
                        animate={{ width: `${answeredPct}%` }}
                        transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      />
                      {liveAnswered.total > 1 && liveAnswered.total <= 60
                        ? Array.from({ length: liveAnswered.total - 1 }).map((_, i) => (
                          <span
                            key={i}
                            aria-hidden="true"
                            className="absolute inset-y-0 w-px bg-obsidian/60"
                            style={{ left: `${((i + 1) / liveAnswered.total) * 100}%` }}
                          />
                        ))
                        : null}
                    </div>
                    <div className="mt-2 flex justify-between text-[12px] text-text-dim">
                      <span>{answeredPct}% answered</span>
                      <span>{Math.max(0, liveAnswered.total - liveAnswered.answered)} still thinking</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Players */}
              <div className="rounded-2xl border border-[rgb(var(--rule))] bg-black/15 p-4">
                <p className="text-[13px] font-medium text-text-muted">In the room</p>
                {livePlayers.length === 0 ? (
                  <p className="mt-3 text-[13px] text-text-dim">Waiting for students to enter the code...</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AnimatePresence initial={false}>
                      {livePlayers.map((p, i) => (
                        <motion.span
                          key={p.name ? `${p.name}-${i}` : i}
                          layout
                          initial={{ opacity: 0, scale: 0.4, y: 8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{ type: "spring", stiffness: 500, damping: 28 }}
                          className="rounded-full border border-[rgb(var(--rule))] bg-white/[0.04] px-3 py-1 text-[13px] text-text-muted"
                        >
                          {p.name} <span className="tabular-nums text-primary">{p.score || 0}</span>
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Standings — bars sized against the leader */}
              {(liveStatus === "results" || liveStatus === "finished") && livePodium.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-4"
                >
                  <p className="text-[13px] font-medium text-primary">
                    {liveStatus === "finished" ? "Final Leaderboard" : "Current Standings"}
                  </p>
                  <ol className="mt-3 space-y-2.5">
                    {livePodium.map((p, i) => (
                      <motion.li key={p.name || i} layout className="relative">
                        <div className="flex items-center justify-between gap-3 text-[13px]">
                          <span className="flex min-w-0 items-center gap-2 text-text-primary">
                            <span className="lamp-numerals w-5 shrink-0 text-text-dim">{p.rank}</span>
                            {p.rank === 1 ? <Crown className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" /> : null}
                            <span className="truncate">{p.name}</span>
                          </span>
                          <span className="lamp-numerals shrink-0 text-primary">
                            <AnimatedNumber value={Number(p.score) || 0} duration={0.9} />
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                          <motion.div
                            className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-secondary/70"}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${((Number(p.score) || 0) / topScore) * 100}%` }}
                            transition={{ delay: 0.1 + i * 0.08, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </div>
                      </motion.li>
                    ))}
                  </ol>
                </motion.div>
              ) : null}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-3 border-t border-[rgb(var(--rule))] pt-5">
              {liveStatus === "lobby" && (
                <Button size="sm" onClick={nextQuestion} disabled={livePlayers.length === 0} leading={<Play className="h-4 w-4" strokeWidth={1.75} />}>
                  Start First Question
                </Button>
              )}
              {liveStatus === "question" && (
                <Button size="sm" variant="secondary" onClick={revealAnswer}>
                  Reveal Answer Now
                </Button>
              )}
              {liveStatus === "results" && liveQuestionNum < liveTotalQ && (
                <Button size="sm" onClick={nextQuestion} leading={<SkipForward className="h-4 w-4" strokeWidth={1.75} />}>
                  Next Question ({liveQuestionNum + 1}/{liveTotalQ})
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={endLiveQuiz} leading={<Square className="h-3.5 w-3.5" strokeWidth={1.75} />}>
                End Quiz
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
