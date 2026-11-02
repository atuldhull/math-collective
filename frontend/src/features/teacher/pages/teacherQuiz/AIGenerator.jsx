import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import MathRender from "@/components/math/MathRender";
import { SegmentedTabs } from "@/components/lamp";

const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard", "Extreme"];

const labelCls = "mb-1.5 block text-[13px] font-medium text-text-muted";
const fieldCls =
  "w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-4 py-3 text-sm text-text-primary placeholder-text-dim backdrop-blur outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15";

export default function AIGenerator({
  aiTopics,
  setAiTopics,
  aiCount,
  setAiCount,
  aiDifficulty,
  setAiDifficulty,
  aiGenerating,
  aiResult,
  handleAiBulk,
}) {
  const total = aiResult ? (aiResult.questions?.length || aiResult.length || 0) : 0;

  return (
    <section data-reveal="right" className="lamp-panel p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-secondary" strokeWidth={1.75} aria-hidden="true" />
        <h2 className="text-xl text-text-primary">Bulk question generator</h2>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="bulk-topics" className={labelCls}>Topics (comma-separated)</label>
          <textarea
            id="bulk-topics"
            placeholder="e.g. Algebra, Geometry, Probability, Number Theory"
            value={aiTopics}
            onChange={(e) => setAiTopics(e.target.value)}
            rows={3}
            className={`${fieldCls} resize-y`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <div>
            <label htmlFor="bulk-count" className={labelCls}>Questions</label>
            <input
              id="bulk-count"
              type="number"
              min={1}
              max={50}
              value={aiCount}
              onChange={(e) =>
                setAiCount(Math.max(1, Math.min(50, Number(e.target.value))))
              }
              className={`${fieldCls} tabular-nums`}
            />
          </div>
          <div className="min-w-0">
            <p className={labelCls}>Difficulty</p>
            <SegmentedTabs
              aria-label="Difficulty"
              size="sm"
              items={DIFFICULTY_OPTIONS.map((d) => ({ value: d, label: d }))}
              value={aiDifficulty}
              onChange={setAiDifficulty}
            />
          </div>
        </div>

        <Button
          onClick={handleAiBulk}
          loading={aiGenerating}
          disabled={!aiTopics.trim()}
          size="sm"
          variant="secondary"
          leading={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
        >
          {aiGenerating ? "Generating..." : "Generate Questions"}
        </Button>

        <AnimatePresence>
          {aiResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-secondary/25 bg-secondary/[0.06] p-4">
                <p className="text-[13px] font-medium text-secondary">
                  Generated {total} questions
                </p>
                <motion.ol
                  className="scrollbar-thin mt-3 max-h-60 space-y-2 overflow-y-auto pr-1"
                  initial="hidden"
                  animate="show"
                  variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } } }}
                >
                  {(aiResult.questions || aiResult || []).slice(0, 10).map((q, i) => (
                    <motion.li
                      key={i}
                      variants={{ hidden: { opacity: 0, x: -14 }, show: { opacity: 1, x: 0 } }}
                      className="rounded-xl border border-[rgb(var(--rule))] bg-black/15 px-3 py-2.5"
                    >
                      {/* Render through MathRender so AI-generated $\\frac{a}{b}$
                          shows as a real fraction instead of raw LaTeX source. */}
                      <div className="overflow-x-auto text-sm text-text-primary [&_.katex]:whitespace-nowrap">
                        <span className="mr-2 tabular-nums text-text-dim">{i + 1}.</span>
                        <MathRender source={String(q.title || q.question || q.text || "")} className="inline [&_.katex]:text-text-primary" />
                      </div>
                      <p className="mt-1 flex gap-3 text-[12px] text-text-dim">
                        <span>{q.difficulty || aiDifficulty}</span>
                        <span>{q.topic || "General"}</span>
                      </p>
                    </motion.li>
                  ))}
                </motion.ol>
                {total > 10 && (
                  <p className="pt-2 text-center text-[12px] text-text-dim">
                    ...and {total - 10} more
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
