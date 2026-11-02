import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { Check, Crosshair, MessageSquare, SkipForward, Sparkles, Target, Timer, Trophy, X, Zap } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { PageHeader, StatTile, SegmentedTabs, TiltPanel, EmptyState } from "@/components/lamp";
import { Flicker } from "@/components/motion/ScrollFx";
import { arena, challenges, leaderboard, comments as commentsApi } from "@/lib/api";
import MathRender from "@/components/math/MathRender";

const ICON = { strokeWidth: 1.75 };
const DIFFICULTIES = ["All", "Easy", "Medium", "Hard", "Extreme"];
const TIME_LIMIT = { easy: 120, medium: 180, hard: 300, extreme: 600 };

// Difficulty reads as a temperature: cool teal for easy, the lamp for
// medium, warm red for hard, violet ink for extreme.
const DIFF_TONE = {
  easy: "border-success/30 bg-success/10 text-success",
  medium: "border-primary/30 bg-primary/10 text-primary",
  hard: "border-danger/30 bg-danger/10 text-danger",
  extreme: "border-secondary/35 bg-secondary/12 text-secondary",
};
/** Status colour as a literal GSAP can tween (it can't read var()). */
function tone(name, alpha) {
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  return `rgba(${raw.split(/\s+/).join(",") || "128,128,128"},${alpha})`;
}

function diffTone(d) {
  return DIFF_TONE[(d || "medium").toLowerCase()] || DIFF_TONE.medium;
}

export default function ArenaPage() {
  const [challenge, setChallenge] = useState(null);
  const [weeklyBoard, setWeeklyBoard] = useState([]);
  const [arenaStats, setArenaStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [difficulty, setDifficulty] = useState("All");
  const [timer, setTimer] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef(null);
  const [commentsList, setCommentsList] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [aiAsking, setAiAsking] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const stage = useRef(null);

  // Load a random challenge automatically
  const loadRandomChallenge = async (diff) => {
    setLoading(true);
    setResult(null);
    setSelectedAnswer(null);
    setNoMore(false);
    try {
      const { data } = await challenges.next(diff === "All" ? undefined : diff.toLowerCase());
      if (data && data.id) {
        setChallenge(data);
      } else {
        setNoMore(true);
        setChallenge(null);
      }
    } catch {
      setNoMore(true);
      setChallenge(null);
    }
    setLoading(false);
  };

  // Load comments when challenge selected
  useEffect(() => {
    if (!challenge) { setCommentsList([]); return; }
    commentsApi.list(challenge.id).then((r) => setCommentsList(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [challenge]);

  const postComment = async () => {
    if (!commentInput.trim() || !challenge) return;
    setCommentLoading(true);
    try {
      await commentsApi.post(challenge.id, commentInput);
      setCommentInput("");
      const { data } = await commentsApi.list(challenge.id);
      setCommentsList(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setCommentLoading(false);
  };

  const askAi = async () => {
    if (!commentInput.trim() || !challenge) return;
    setAiAsking(true);
    try {
      await commentsApi.post(challenge.id, commentInput);
      await commentsApi.askAi(challenge.id, commentInput, challenge.title);
      setCommentInput("");
      const { data } = await commentsApi.list(challenge.id);
      setCommentsList(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setAiAsking(false);
  };

  // Timer
  useEffect(() => {
    if (!challenge || result) { clearInterval(timerRef.current); return; }
    const timeLimit = { easy: 120, medium: 180, hard: 300, extreme: 600 };
    const secs = timeLimit[(challenge.difficulty || "medium").toLowerCase()] || 180;
    setTimer(secs);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [challenge, result]);

  // Cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Initial load — fetch stats, leaderboard, and first random challenge
  useEffect(() => {
    Promise.all([
      leaderboard.weekly().catch(() => ({ data: [] })),
      arena.stats().catch(() => ({ data: null })),
    ]).then(([lb, st]) => {
      setWeeklyBoard(Array.isArray(lb.data) ? lb.data : []);
      setArenaStats(st.data);
    });
    loadRandomChallenge(difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (selectedAnswer === null || cooldown > 0 || !challenge) return;
    setSubmitting(true);
    setResult(null);
    clearInterval(timerRef.current);
    try {
      const { data } = await arena.submit(challenge.id, selectedAnswer);
      setResult(data);
      setCooldown(5);
      // Refresh stats
      arena.stats().then((r) => setArenaStats(r.data)).catch(() => {});
    } catch (err) {
      setResult({ error: err.response?.data?.error || "Submission failed" });
    }
    setSubmitting(false);
  };

  const handleNext = () => {
    loadRandomChallenge(difficulty);
  };

  const handleDifficultyChange = (d) => {
    setDifficulty(d);
    loadRandomChallenge(d);
  };

  // ── Motion ─────────────────────────────────────────────────────
  // New challenge: the card flips up off the desk and its options
  // deal in one after another.
  useGSAP(() => {
    if (!challenge || loading) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.timeline({ defaults: { ease: "expo.out" } })
        .from("[data-card]", { rotateX: -18, y: 40, autoAlpha: 0, transformPerspective: 1100, transformOrigin: "50% 100%", duration: 0.9 })
        .from("[data-option]", { x: -24, autoAlpha: 0, duration: 0.6, stagger: 0.07 }, 0.25);
    });
    return () => mm.revert();
  }, { scope: stage, dependencies: [challenge?.id, loading], revertOnUpdate: true });

  // Verdict: a correct answer bursts lamp sparks out of the verdict and
  // pulses the card's border green; a wrong one shakes the card on its
  // hinge and flashes the border red.
  useGSAP(() => {
    if (!result || result.error) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const card = stage.current?.querySelector("[data-card]");
      const tl = gsap.timeline();
      if (result.correct) {
        const sparks = gsap.utils.toArray("[data-spark]");
        tl.fromTo("[data-verdict]", { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.7, ease: "back.out(2.4)" })
          .fromTo(sparks,
            { x: 0, y: 0, scale: 1, autoAlpha: 1 },
            {
              x: (i) => Math.cos((i / sparks.length) * Math.PI * 2) * gsap.utils.random(70, 150),
              y: (i) => Math.sin((i / sparks.length) * Math.PI * 2) * gsap.utils.random(40, 90),
              scale: 0, autoAlpha: 0, duration: 1.1, ease: "expo.out", stagger: 0.01,
            }, 0.05)
          .fromTo(card, { boxShadow: `0 0 0 1px ${tone("success", 0.9)}, 0 0 60px -10px ${tone("success", 0.6)}` },
            { boxShadow: `0 0 0 1px ${tone("success", 0)}, 0 0 0px 0px ${tone("success", 0)}`, duration: 1.4, ease: "power2.out", clearProps: "boxShadow" }, 0)
          .from("[data-xp]", { y: 16, autoAlpha: 0, duration: 0.6, ease: "back.out(3)" }, 0.3);
      } else {
        tl.to(card, {
          keyframes: { x: [0, -14, 12, -9, 7, -4, 0], rotate: [0, -0.6, 0.5, -0.3, 0.2, 0, 0] },
          duration: 0.6, ease: "power1.inOut",
        })
          .fromTo(card, { boxShadow: `0 0 0 1px ${tone("danger", 0.9)}, 0 0 50px -12px ${tone("danger", 0.6)}` },
            { boxShadow: `0 0 0 1px ${tone("danger", 0)}, 0 0 0px 0px ${tone("danger", 0)}`, duration: 1.2, ease: "power2.out", clearProps: "boxShadow" }, 0)
          .fromTo("[data-verdict]", { y: -10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, ease: "power3.out" }, 0.1)
          .from("[data-reveal-answer]", { y: 14, autoAlpha: 0, duration: 0.6, ease: "power3.out" }, 0.4);
      }
      tl.from("[data-solution]", { y: 14, autoAlpha: 0, duration: 0.6, ease: "power3.out" }, 0.55);
    });
    return () => mm.revert();
  }, { scope: stage, dependencies: [result], revertOnUpdate: true });

  const totalSecs = challenge ? TIME_LIMIT[(challenge.difficulty || "medium").toLowerCase()] || 180 : 1;
  const timeShare = Math.max(0, Math.min(1, timer / totalSecs));
  const accuracy = Number.parseFloat(arenaStats?.accuracy || 0) || 0;

  return (
    <div className="pb-16">
      <PageHeader
        context="Challenge arena"
        title="The *arena*"
        description="Random challenges, one at a time. Solve them against the clock, earn points, climb the weekly board."
      >
        <SegmentedTabs
          aria-label="Difficulty"
          items={DIFFICULTIES.map((d) => ({ value: d, label: d }))}
          value={difficulty}
          onChange={handleDifficultyChange}
        />
      </PageHeader>

      {arenaStats && (
        <section data-stagger="fog" className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile label="Attempts" value={Number(arenaStats.total || 0)} icon={Crosshair} />
          <StatTile label="Correct" value={Number(arenaStats.correct || 0)} icon={Check} tone="good" sub="answers that landed" />
          <StatTile label="Total XP" value={Number(arenaStats.totalXP || 0)} icon={Zap} tone="lamp" sub="earned in the arena" />
          <StatTile label="Accuracy" value={accuracy} suffix="%" icon={Target} />
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
        <div ref={stage} className="min-w-0 [perspective:1400px]">
          {/* Loading state */}
          {loading && (
            <div className="lamp-panel flex min-h-[40vh] items-center justify-center">
              <Loader variant="orbit" size="lg" label="Loading challenge..." />
            </div>
          )}

          {/* No more challenges */}
          {!loading && noMore && (
            <EmptyState
              title="No more challenges available"
              body="You've solved them all or none match this difficulty. Try every difficulty, or check back later."
              action={(
                <Button variant="secondary" onClick={() => handleDifficultyChange("All")}>
                  Try all difficulties
                </Button>
              )}
            />
          )}

          {/* Active Challenge */}
          {!loading && challenge && (
            <section key={challenge.id}>
              <TiltPanel data-card lit tilt={!!result} className="p-5 sm:p-8">
                {/* Header */}
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[12px] font-medium capitalize ${diffTone(challenge.difficulty)}`}>
                      {challenge.difficulty || "Medium"}
                    </span>
                    <span className="text-[13px] tabular-nums text-text-muted">{challenge.points || 50} pts</span>
                    {!result && timer > 0 && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium tabular-nums ${
                        timer <= 30 ? "animate-pulse border-danger/40 bg-danger/10 text-danger" : timer <= 60 ? "border-warning/30 bg-warning/10 text-warning" : "border-[rgb(var(--rule))] text-text-muted"
                      }`}>
                        <Timer className="h-3.5 w-3.5" aria-hidden="true" {...ICON} />
                        {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
                      </span>
                    )}
                    {!result && timer === 0 && (
                      <span className="rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-[13px] font-medium text-danger">
                        Time's up!
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleNext} leading={<SkipForward className="h-3.5 w-3.5" {...ICON} />}>
                    Skip
                  </Button>
                </div>

                {/* The clock as a draining rule line. */}
                {!result && (
                  <div aria-hidden="true" className="relative mt-4 h-px w-full bg-[rgb(var(--rule))]">
                    <div
                      className={`absolute inset-y-0 left-0 w-full origin-left transition-transform duration-1000 ease-linear ${timer <= 30 ? "bg-danger" : "bg-primary"}`}
                      style={{ transform: `scaleX(${timeShare})` }}
                    />
                  </div>
                )}

                {/* Question — math segments rendered via KaTeX so
                    authored $\int_0^1 x\,dx$ shows as a real integral. */}
                <h2 className="lamp-display relative mt-5 text-2xl leading-tight text-text-primary sm:text-[1.9rem]" style={{ textWrap: "balance" }}>
                  {challenge.title}
                </h2>
                <div className="relative overflow-x-auto">
                  <MathRender
                    source={String(challenge.question || "")}
                    className="mt-3 text-[15px] leading-7 text-text-muted [&_.katex]:text-text-primary"
                  />
                </div>

                {/* Options */}
                {!result && (
                  <div className="relative mt-6 space-y-2.5">
                    {(challenge.options || []).length === 0 && (
                      <p className="text-sm text-danger">This question has no options. Skipping...</p>
                    )}
                    {(challenge.options || []).map((opt, i) => {
                      const picked = selectedAnswer === i;
                      return (
                        <motion.button
                          key={i}
                          data-option
                          whileTap={{ scale: 0.985 }}
                          onClick={() => setSelectedAnswer(i)}
                          aria-pressed={picked}
                          className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors duration-200 ${
                            picked
                              ? "border-primary/50 bg-primary/10 text-text-primary shadow-[0_8px_28px_-14px_rgb(var(--lamp)/0.9)]"
                              : "border-[rgb(var(--rule))] bg-obsidian/30 text-text-muted hover:border-primary/30 hover:text-text-primary"
                          }`}
                        >
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold transition-colors ${
                            picked ? "bg-primary text-[rgb(var(--color-obsidian))]" : "bg-white/[0.05] text-text-dim"
                          }`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <MathRender source={String(opt || "")} className="inline min-w-0 break-words [&_.katex]:text-current [&_.katex]:whitespace-normal" />
                        </motion.button>
                      );
                    })}
                    <Button
                      onClick={handleSubmit}
                      loading={submitting}
                      disabled={selectedAnswer === null || (challenge.options || []).length === 0}
                      size="lg"
                      className="mt-4 w-full justify-center"
                    >
                      Submit answer
                    </Button>
                  </div>
                )}

                {/* Result */}
                {result && !result.error && (
                  <div className="relative mt-6 space-y-4">
                    <div
                      data-verdict
                      className={`relative flex items-center gap-4 rounded-2xl border px-5 py-4 ${
                        result.correct ? "border-success/35 bg-success/10" : "border-danger/35 bg-danger/10"
                      }`}
                    >
                      {result.correct && (
                        <span aria-hidden="true" className="pointer-events-none absolute left-9 top-1/2">
                          {Array.from({ length: 14 }).map((_, i) => (
                            <span
                              key={i}
                              data-spark
                              className={`absolute h-1.5 w-1.5 rounded-full opacity-0 ${i % 3 === 0 ? "bg-success" : "bg-primary"}`}
                            />
                          ))}
                        </span>
                      )}
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        result.correct ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                      }`}>
                        {result.correct ? <Check className="h-5 w-5" {...ICON} /> : <X className="h-5 w-5" {...ICON} />}
                      </span>
                      <div className="min-w-0">
                        <p className={`lamp-display text-2xl ${result.correct ? "text-success" : "text-danger"}`}>
                          {result.correct ? "Correct!" : "Incorrect"}
                        </p>
                        {result.correct && result.xpEarned > 0 && <p data-xp className="mt-0.5 text-sm tabular-nums text-success">+{result.xpEarned} XP earned</p>}
                        {!result.correct && result.xpEarned < 0 && <p data-xp className="mt-0.5 text-sm tabular-nums text-danger">{result.xpEarned} XP penalty</p>}
                        {result.alreadySolved && <p className="mt-0.5 text-[13px] text-text-dim">Already solved before</p>}
                      </div>
                    </div>
                    {/* The answer comes from the SUBMIT response, not from the
                        challenge payload. The question endpoints no longer ship
                        correct_index — it was readable in the Network tab before
                        the student had answered. */}
                    {!result.correct && challenge.options && result.correctIndex != null && (
                      <div data-reveal-answer className="rounded-xl border border-success/20 bg-success/[0.06] px-4 py-3">
                        <p className="text-[13px] font-medium text-success">Correct answer</p>
                        <p className="mt-1 text-sm text-text-primary">
                          <span className="mr-2 font-semibold text-success">{String.fromCharCode(65 + result.correctIndex)}.</span>
                          {challenge.options[result.correctIndex]}
                        </p>
                      </div>
                    )}
                    {result.solution && (
                      <div data-solution className="rounded-xl border border-[rgb(var(--rule))] bg-obsidian/30 px-4 py-3">
                        <p className="text-[13px] font-medium text-text-muted">Solution</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-muted">{result.solution}</p>
                      </div>
                    )}
                    <Button variant="secondary" onClick={handleNext} disabled={cooldown > 0} size="lg" className="w-full justify-center">
                      {cooldown > 0 ? `Next challenge (${cooldown}s)` : "Next challenge"}
                    </Button>
                  </div>
                )}
                {result?.error && (
                  <div className="relative mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {result.error}
                  </div>
                )}

                {/* Discussion */}
                <div className="relative mt-7 border-t border-[rgb(var(--rule))] pt-5">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-text-muted">
                    <MessageSquare className="h-4 w-4 text-text-dim" aria-hidden="true" {...ICON} />
                    Discussion
                  </p>
                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                    {commentsList.length === 0 && <p className="text-[13px] text-text-dim">No comments yet. Ask a question or share a hint.</p>}
                    <AnimatePresence initial={false}>
                      {commentsList.map((c) => (
                        <motion.div
                          key={c.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`rounded-xl px-3 py-2.5 text-[13px] ${c.is_ai ? "border border-secondary/25 bg-secondary/[0.08] text-text-muted" : "bg-white/[0.03] text-text-muted"}`}
                        >
                          <span className="font-medium text-text-primary">{c.user_name}</span>
                          {c.is_ai && <span className="ml-1.5 rounded-md bg-secondary/20 px-1.5 py-0.5 text-[11px] font-medium text-secondary">AI</span>}
                          <span className="ml-2 text-[12px] text-text-dim">{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</span>
                          <p className="mt-1 whitespace-pre-wrap leading-5">{c.content}</p>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input type="text" value={commentInput} onChange={(e) => setCommentInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && postComment()}
                      placeholder="Comment or ask a question..."
                      className="h-10 min-w-0 flex-1 basis-full rounded-xl border border-[rgb(var(--rule))] bg-obsidian/40 px-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/40 sm:basis-auto" />
                    <Button variant="ghost" size="sm" onClick={postComment} disabled={commentLoading || !commentInput.trim()}>
                      Post
                    </Button>
                    <Button variant="secondary" size="sm" onClick={askAi} disabled={aiAsking || !commentInput.trim()} leading={<Sparkles className="h-3.5 w-3.5" {...ICON} />}>
                      {aiAsking ? "..." : "Ask AI"}
                    </Button>
                  </div>
                </div>
              </TiltPanel>
            </section>
          )}
        </div>

        {/* Leaderboard sidebar */}
        <aside data-reveal="right" className="min-w-0">
          <section className="lamp-panel p-5 xl:sticky xl:top-24">
            <Flicker as="h3" className="flex items-center gap-2 text-lg text-text-primary">
              <Trophy className="h-4 w-4 text-primary" aria-hidden="true" {...ICON} />
              This week&apos;s top performers
            </Flicker>
            {weeklyBoard.length === 0 ? (
              <p className="mt-4 text-[13px] text-text-dim">No rankings yet. Solve a challenge to open the board.</p>
            ) : (
              <ol data-stagger="left" className="mt-4 space-y-1">
                {weeklyBoard.slice(0, 10).map((player, i) => (
                  <li
                    key={i}
                    className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 ${i === 0 ? "bg-primary/[0.08]" : ""}`}
                  >
                    <span className={`lamp-numerals flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                      i === 0 ? "bg-primary text-[rgb(var(--color-obsidian))]" : i < 3 ? "bg-primary/15 text-primary" : "bg-white/[0.05] text-text-dim"
                    }`}>
                      {i + 1}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm text-text-primary">{player.name || player.student_name}</p>
                    <span className="lamp-numerals text-base text-primary">{player.weekly_xp || player.xp || 0}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
