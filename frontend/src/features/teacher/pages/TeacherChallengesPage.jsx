import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { teacher } from "@/lib/api";
import { EmptyState, PageHeader, SegmentedTabs } from "@/components/lamp";

const difficultyColors = {
  Easy: "text-success",
  Medium: "text-warning",
  Hard: "text-danger",
  Extreme: "text-glow",
};

const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard", "Extreme"];

/** A small sliding switch — the knob springs across when a challenge flips. */
function StatusToggle({ active, busy, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={active}
      className="group inline-flex min-h-[40px] items-center gap-2.5 text-[13px] font-medium disabled:opacity-60"
    >
      <span
        className={`relative flex h-6 w-11 items-center rounded-full border p-0.5 transition-colors duration-300 ${
          active ? "justify-end border-success/40 bg-success/20" : "justify-start border-[rgb(var(--rule))] bg-white/[0.04]"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 520, damping: 32 }}
          className={`h-[18px] w-[18px] rounded-full ${active ? "bg-success" : "bg-text-dim"} ${busy ? "animate-pulse" : ""}`}
        />
      </span>
      <span className={busy ? "text-text-dim" : active ? "text-warning group-hover:text-danger" : "text-success group-hover:text-primary"}>
        {busy ? "..." : active ? "Deactivate" : "Activate"}
      </span>
    </button>
  );
}

function StatusPill({ active }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${active ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function TeacherChallengesPage() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  // AI generation state
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [saving, setSaving] = useState(false);
  const [genError, setGenError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchChallenges();
  }, []);

  async function fetchChallenges() {
    try {
      setLoading(true);
      const res = await teacher.challenges();
      setChallenges(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load challenges");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id) {
    try {
      setTogglingId(id);
      await teacher.toggleChallenge(id);
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, is_active: !c.is_active } : c,
        ),
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to toggle challenge");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleGenerate() {
    if (!topic.trim()) return;
    try {
      setGenerating(true);
      setGenError(null);
      setGenerated(null);
      setSaveSuccess(false);
      const res = await teacher.generate(topic, difficulty);
      setGenerated(res.data);
    } catch (err) {
      // Distinguish "backend sent an error reason" from "the request
      // never reached the server" (CORS, offline, timeout with no
      // response). Users were seeing a bare "AI generation failed"
      // when axios had no response object at all — now they see a
      // specific hint that points at the right place to look.
      const data = err?.response?.data;
      const status = err?.response?.status;
      let msg;
      if (data?.error || data?.message) {
        msg = data.error || data.message;
      } else if (!err?.response) {
        msg = `Network error — the request didn't reach the server (${err?.code || err?.message || "unknown"}). Check your connection and try again.`;
      } else {
        msg = `AI generation failed (HTTP ${status}). Try again or lower the difficulty.`;
      }
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveQuestion() {
    if (!generated) return;
    try {
      setSaving(true);
      await teacher.saveQuestion(generated);
      setSaveSuccess(true);
      setGenerated(null);
      setTopic("");
      // Refresh challenges list
      fetchChallenges();
    } catch (err) {
      setGenError(err.response?.data?.message || "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 w-64 animate-pulse rounded-xl bg-surface/40" />
        <div className="h-96 animate-pulse rounded-[1.25rem] border border-[rgb(var(--rule))] bg-surface/40" />
        <div className="h-64 animate-pulse rounded-[1.25rem] border border-[rgb(var(--rule))] bg-surface/40" />
      </div>
    );
  }

  const activeCount = challenges.filter((c) => c.is_active).length;
  const isCorrect = (i) =>
    i === generated?.correct_index || i === generated?.correctIndex || i === generated?.answer;

  return (
    <div className="space-y-6">
      <PageHeader
        context="Teacher panel"
        title="Challenge manager"
        description={`${challenges.length} total challenges, ${activeCount} live for students right now.`}
        progress={challenges.length ? activeCount / challenges.length : undefined}
      />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Question Generation — the lit panel: it's where new work starts */}
      <section data-reveal="up" className="lamp-panel lamp-panel--lit p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl text-text-primary sm:text-2xl">Question generator</h2>
            <p className="mt-1 text-sm text-text-muted">Name a topic, pick a difficulty, and review the draft before it joins the bank.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="gen-topic" className="mb-1.5 block text-[13px] font-medium text-text-muted">
              Topic
            </label>
            <input
              id="gen-topic"
              type="text"
              placeholder="e.g. Quadratic equations, Probability, Set theory..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-4 py-3 text-sm text-text-primary placeholder-text-dim backdrop-blur outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-text-muted">Difficulty</p>
              <SegmentedTabs
                aria-label="Difficulty"
                size="sm"
                items={DIFFICULTY_OPTIONS.map((d) => ({ value: d, label: d }))}
                value={difficulty}
                onChange={setDifficulty}
              />
            </div>
            <Button
              onClick={handleGenerate}
              loading={generating}
              disabled={!topic.trim()}
              size="md"
              variant="primary"
              leading={<Sparkles className="h-4 w-4" strokeWidth={1.75} />}
            >
              {generating ? "Generating..." : "Generate Question"}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {genError && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              role="alert"
              className="mt-4 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              {genError}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {saveSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Question saved to bank successfully!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated preview flips up like a card turned over on the desk */}
        <AnimatePresence mode="wait">
          {generated && (
            <motion.div
              key={generated.title || generated.question || "generated"}
              initial={{ opacity: 0, rotateX: -70, y: 30 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              exit={{ opacity: 0, rotateX: 40, y: -10 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformPerspective: 1200, transformOrigin: "top center" }}
              className="mt-6"
            >
              <div className="rounded-2xl border border-primary/25 bg-[linear-gradient(180deg,rgb(var(--lamp)/0.08),transparent_60%)] p-5 sm:p-6">
                <p className="text-[13px] font-medium text-primary">Draft for review</p>
                <h3 className="mt-2 text-lg text-text-primary sm:text-xl">
                  {generated.title || "Untitled Question"}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  {generated.question || generated.text}
                </p>

                {generated.options && (
                  <motion.div
                    className="mt-4 space-y-2"
                    initial="hidden"
                    animate="show"
                    variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.3 } } }}
                  >
                    {generated.options.map((opt, i) => (
                      <motion.div
                        key={i}
                        variants={{ hidden: { opacity: 0, x: -12 }, show: { opacity: 1, x: 0 } }}
                        className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                          isCorrect(i)
                            ? "border-success/35 bg-success/10 text-success"
                            : "border-[rgb(var(--rule))] bg-black/10 text-text-muted"
                        }`}
                      >
                        <span className="font-mono text-xs leading-5">{String.fromCharCode(65 + i)}</span>
                        <span className="flex-1">{opt}</span>
                        {isCorrect(i) ? <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> : null}
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {(generated.explanation || generated.solution) && (
                  <div className="mt-4 border-l-2 border-secondary/50 pl-4">
                    <p className="text-[13px] font-medium text-secondary">Explanation</p>
                    <p className="mt-1 text-sm leading-relaxed text-text-muted">{generated.explanation || generated.solution}</p>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={handleSaveQuestion} loading={saving} size="sm" variant="primary">
                    Save to Bank
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    loading={generating}
                    size="sm"
                    variant="secondary"
                    leading={<RefreshCw className="h-4 w-4" strokeWidth={1.75} />}
                  >
                    Regenerate
                  </Button>
                  <Button
                    onClick={() => setGenerated(null)}
                    size="sm"
                    variant="ghost"
                    leading={<Trash2 className="h-4 w-4" strokeWidth={1.75} />}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Question bank */}
      <section data-reveal="up" className="lamp-panel p-4 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl text-text-primary">All challenges</h2>
          <span className="text-[13px] tabular-nums text-text-dim">{activeCount} active</span>
        </div>

        {challenges.length === 0 ? (
          <EmptyState
            compact
            className="mt-4 border-none bg-transparent"
            title="No challenges found"
            body="Generate one with the question generator above and save it to the bank."
          />
        ) : (
          <>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--rule))] text-[13px] text-text-muted">
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Difficulty</th>
                    <th className="px-4 py-3 text-right font-medium">Points</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody data-stagger="up">
                  {challenges.map((c) => (
                    <tr key={c.id} className="border-b border-[rgb(var(--rule)/0.6)] transition-colors hover:bg-primary/[0.04]">
                      <td className="px-4 py-3 font-medium text-text-primary">{c.title}</td>
                      <td className={`px-4 py-3 text-[13px] font-medium ${difficultyColors[c.difficulty] || "text-text-muted"}`}>
                        {c.difficulty}
                      </td>
                      <td className="lamp-numerals px-4 py-3 text-right text-primary">{c.points ?? "—"}</td>
                      <td className="px-4 py-3"><StatusPill active={c.is_active} /></td>
                      <td className="px-4 py-2">
                        <StatusToggle active={c.is_active} busy={togglingId === c.id} onToggle={() => handleToggle(c.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone / tablet: stacked rows */}
            <ul data-stagger="up" className="mt-3 divide-y divide-[rgb(var(--rule))] md:hidden">
              {challenges.map((c) => (
                <li key={c.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 font-medium text-text-primary">{c.title}</p>
                    <StatusPill active={c.is_active} />
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[13px]">
                    <span className={difficultyColors[c.difficulty] || "text-text-muted"}>{c.difficulty}</span>
                    <span className="tabular-nums text-primary">{c.points ?? "—"} pts</span>
                  </div>
                  <div className="mt-2">
                    <StatusToggle active={c.is_active} busy={togglingId === c.id} onToggle={() => handleToggle(c.id)} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
