import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, Search } from "lucide-react";
import Button from "@/components/ui/Button";

const labelCls = "mb-1.5 block text-[13px] font-medium text-text-muted";
const fieldCls =
  "w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-4 py-3 text-sm text-text-primary placeholder-text-dim backdrop-blur outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15 [color-scheme:dark]";

export default function TestCreator({
  // Form state
  title,
  setTitle,
  description,
  setDescription,
  selectedChallenges,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  creatingTest,
  challengeSearch,
  setChallengeSearch,
  filteredPool,
  poolLoading,
  // Actions
  toggleChallenge,
  handleCreateTest,
}) {
  return (
    <section data-reveal="left" className="lamp-panel p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <CalendarClock className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
        <h2 className="text-xl text-text-primary">Create scheduled test</h2>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="test-title" className={labelCls}>Test title</label>
          <input
            id="test-title"
            type="text"
            placeholder="e.g. Weekly Challenge Set #5"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldCls}
          />
        </div>

        <div>
          <label htmlFor="test-desc" className={labelCls}>Description</label>
          <textarea
            id="test-desc"
            placeholder="Brief description of the test..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${fieldCls} resize-y`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="test-start" className={labelCls}>Start date &amp; time</label>
            <input
              id="test-start"
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={fieldCls}
            />
          </div>
          <div>
            <label htmlFor="test-end" className={labelCls}>End date &amp; time</label>
            <input
              id="test-end"
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={fieldCls}
            />
          </div>
        </div>

        <div>
          <p className={labelCls}>
            Select challenges (
            <motion.span
              key={selectedChallenges.length}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="inline-block tabular-nums text-primary"
            >
              {selectedChallenges.length}
            </motion.span>
            {" "}selected)
          </p>
          <label className="relative mb-3 block">
            <span className="sr-only">Search challenges</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
            <input
              type="text"
              placeholder="Search challenges..."
              value={challengeSearch}
              onChange={(e) => setChallengeSearch(e.target.value)}
              className={`${fieldCls} py-2.5 pl-11`}
            />
          </label>

          {poolLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl border border-[rgb(var(--rule))] bg-surface/30" />
              ))}
            </div>
          ) : (
            <div className="scrollbar-thin max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {filteredPool.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-dim">
                  {challengeSearch ? "No challenges match" : "No challenges available"}
                </p>
              ) : (
                filteredPool.map((c) => {
                  const isSelected = selectedChallenges.includes(c._id);
                  return (
                    <motion.button
                      key={c._id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleChallenge(c._id)}
                      aria-pressed={isSelected}
                      className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "border-primary/35 bg-primary/10 text-text-primary"
                          : "border-[rgb(var(--rule))] bg-black/10 text-text-muted hover:border-primary/25 hover:text-text-primary"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          isSelected ? "border-primary bg-primary text-[rgb(var(--color-obsidian))]" : "border-[rgb(var(--rule))]"
                        }`}
                      >
                        <AnimatePresence>
                          {isSelected && (
                            <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{c.title}</p>
                        <p className="mt-0.5 flex gap-3 text-[12px] text-text-dim">
                          <span>{c.difficulty || "—"}</span>
                          <span className="tabular-nums">{c.points ?? 0} pts</span>
                        </p>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <Button
          onClick={handleCreateTest}
          loading={creatingTest}
          disabled={!title.trim() || selectedChallenges.length === 0}
          size="sm"
        >
          Create Test
        </Button>
      </div>
    </section>
  );
}
