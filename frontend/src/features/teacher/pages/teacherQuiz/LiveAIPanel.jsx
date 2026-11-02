import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";

const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard", "Extreme"];

/**
 * Inline AI generation panel used inside the Live Quiz Host setup view.
 * Generates questions, lets the teacher review/select them, then saves chosen
 * ones to the question bank so they appear in the picker immediately.
 */
export default function LiveAIPanel({
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
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-text-muted">
        <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} aria-hidden="true" />
        Or Generate with AI
      </p>
      <div className="relative space-y-3 overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
        <AnimatePresence>
          {aiGenerating ? (
            <motion.span
              key="sweep"
              aria-hidden="true"
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: "100%", opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ x: { duration: 1.4, repeat: Infinity, ease: "easeInOut" } }}
              className="pointer-events-none absolute inset-y-0 left-0 w-full bg-[linear-gradient(90deg,transparent,rgb(var(--lamp)/0.12),transparent)]"
            />
          ) : null}
        </AnimatePresence>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-text-dim">Topics (comma separated)</label>
          <input
            type="text"
            value={aiTopics}
            onChange={(e) => setAiTopics(e.target.value)}
            placeholder="Calculus, Number Theory, Probability"
            className="w-full rounded-xl border border-[rgb(var(--rule))] bg-black/20 px-3 py-2.5 text-[13px] text-text-primary outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-[12px] font-medium text-text-dim">Count</label>
            <input
              type="number"
              min="1"
              max="20"
              value={aiCount}
              onChange={(e) => setAiCount(Number(e.target.value))}
              className="w-full rounded-xl border border-[rgb(var(--rule))] bg-black/20 px-3 py-2.5 text-[13px] text-text-primary outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[12px] font-medium text-text-dim">Difficulty</label>
            <select
              value={aiDifficulty}
              onChange={(e) => setAiDifficulty(e.target.value)}
              className="w-full rounded-xl border border-[rgb(var(--rule))] bg-black/20 px-3 py-2.5 text-[13px] text-text-primary outline-none transition focus:border-primary/40"
            >
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          size="sm"
          loading={aiGenerating}
          onClick={async () => {
            if (!aiTopics.trim()) { setError("Enter at least one topic"); return; }
            setAiGenerating(true);
            setAiResult(null);
            try {
              const { quiz } = await import("@/lib/api");
              const { data } = await quiz.aiBulk({
                topics: aiTopics.split(",").map((t) => t.trim()).filter(Boolean),
                count: aiCount,
                difficulty: aiDifficulty,
                saveToBank: false,
              });
              const qs = (data.questions || []).map((q, i) => ({ ...q, _selected: true, _idx: i }));
              setAiResult({ ...data, questions: qs });
              setSuccess(
                `Generated ${data.generated || qs.length} questions — review below and save the ones you like`,
              );
            } catch (err) {
              setError(err.response?.data?.error || "AI generation failed");
            }
            setAiGenerating(false);
          }}
        >
          Generate {aiCount} Questions
        </Button>

        {/* AI result: full preview with accept/reject per question */}
        {aiResult && aiResult.questions && aiResult.questions.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <p className="text-[12px] font-medium text-success">
                {aiResult.questions.length} generated — pick the ones you want to save
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setAiResult({
                      ...aiResult,
                      questions: aiResult.questions.map((q) => ({ ...q, _selected: true })),
                    })
                  }
                  className="-my-1 min-h-[40px] rounded px-2 text-[13px] font-medium text-primary hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={() =>
                    setAiResult({
                      ...aiResult,
                      questions: aiResult.questions.map((q) => ({ ...q, _selected: false })),
                    })
                  }
                  className="-my-1 min-h-[40px] rounded px-2 text-[13px] font-medium text-text-dim hover:underline"
                >
                  Deselect all
                </button>
              </div>
            </div>

            <motion.div
              className="scrollbar-thin max-h-[400px] space-y-2 overflow-y-auto pr-1"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            >
              {aiResult.questions.map((q, i) => (
                <motion.div
                  key={i}
                  variants={{ hidden: { opacity: 0, y: 14, rotateX: -20 }, show: { opacity: 1, y: 0, rotateX: 0 } }}
                  className={`rounded-xl border p-3 transition-[opacity,background-color,border-color] ${
                    q._selected
                      ? "border-primary/25 bg-primary/5"
                      : "border-[rgb(var(--rule))] bg-black/10 opacity-60"
                  }`}
                >
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={q._selected}
                      onChange={() => {
                        const updated = [...aiResult.questions];
                        updated[i] = { ...updated[i], _selected: !updated[i]._selected };
                        setAiResult({ ...aiResult, questions: updated });
                      }}
                      className="mt-1 accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-text-primary">{q.title}</p>
                      <p className="mt-1 line-clamp-2 text-[12px] text-text-muted">{q.question}</p>
                      {q.options && (
                        <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                          {q.options.map((opt, oi) => (
                            <div
                              key={oi}
                              className={`break-words rounded-md px-2 py-1 text-[12px] ${
                                oi === q.correct_index
                                  ? "bg-success/10 text-success font-medium"
                                  : "bg-white/[0.02] text-text-dim"
                              }`}
                            >
                              {String.fromCharCode(65 + oi)}. {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      {q.solution && (
                        <p className="mt-1.5 text-[12px] italic text-text-dim">
                          Solution: {q.solution}
                        </p>
                      )}
                      <div className="mt-1 flex gap-3 text-[11px] text-text-dim">
                        <span>{q.difficulty || aiDifficulty}</span>
                        <span>{q.points || 50} pts</span>
                      </div>
                    </div>
                  </label>
                </motion.div>
              ))}
            </motion.div>

            {/* Save selected to bank */}
            <Button
              size="sm"
              loading={aiGenerating}
              onClick={async () => {
                const toSave = aiResult.questions.filter((q) => q._selected);
                if (toSave.length === 0) { setError("Select at least one question to save"); return; }
                setAiGenerating(true);
                // Route to the teacher endpoint (accessible to both
                // teacher AND admin roles per requireTeacher) instead
                // of challenges.create which is admin-only and 403s
                // for teachers — the root of every teacher hitting
                // "Saved 0/1 questions to bank" on this page.
                const { teacher } = await import("@/lib/api");
                let saved = 0;
                let firstErr = null;
                for (const q of toSave) {
                  try {
                    await teacher.saveQuestion({
                      title: q.title,
                      question: q.question,
                      options: q.options,
                      correct_index: q.correct_index ?? 0,
                      difficulty: (q.difficulty || aiDifficulty).toLowerCase(),
                      points: q.points || 50,
                      solution: q.solution || "",
                    });
                    saved++;
                  } catch (err) {
                    // Capture the first failure reason so we can show
                    // it to the admin instead of the silent "0/1" that
                    // left them staring at a broken form with no clue.
                    if (!firstErr) {
                      firstErr = err?.response?.data?.error
                        || err?.response?.data?.message
                        || err?.message
                        || "Save failed";
                    }
                  }
                }
                if (saved === toSave.length) {
                  setSuccess(`Saved ${saved}/${toSave.length} questions to bank`);
                } else if (saved > 0) {
                  setError(`Saved ${saved}/${toSave.length} — the rest failed: ${firstErr}`);
                } else {
                  setError(`Could not save any questions: ${firstErr}`);
                }
                setAiResult(null);
                const { quiz } = await import("@/lib/api");
                const poolRes = await quiz.challenges();
                setChallengePool(poolRes.data || []);
                setAiGenerating(false);
              }}
            >
              Save {aiResult.questions.filter((q) => q._selected).length} Selected to Bank
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
