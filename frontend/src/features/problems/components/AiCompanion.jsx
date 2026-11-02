/**
 * AiCompanion — collapsible Socratic Q&A panel for a problem.
 *
 * Mounted under the "How to start" section on /problems/:slugOrId.
 * Starts collapsed so the page weight is low for visitors who don't
 * want hints. When opened, shows a single textarea + history of the
 * current session's exchanges.
 *
 * The backend (problemController.askProblemAi) injects the problem
 * context into the system prompt and tells the model to be Socratic,
 * so we ship just the question. No conversation history is sent to
 * the backend — each question stands alone (saves tokens and avoids
 * the model echoing prior solutions).
 *
 * Rate limit: aiLimiter on the route (20/hr/user, shared with
 * /bot/chat and /comments/ask-ai). The client gets a clear 429
 * message if hit; we show it inline.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles, ArrowUp } from "lucide-react";
import { problems } from "@/lib/api";

export default function AiCompanion({ slugOrId }) {
  const [open,     setOpen]     = useState(false);
  const [question, setQuestion] = useState("");
  const [history,  setHistory]  = useState([]); // [{ q, a }]
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState(null);
  const scrollRef = useRef(null);

  // Auto-scroll the answer feed to the bottom when a new answer lands.
  useEffect(() => {
    if (scrollRef.current && history.length) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length, busy]);

  async function onAsk(e) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    // Add the question to history immediately so the user sees their
    // own input rendered while the answer is fetching. Placeholder
    // answer becomes the real reply on resolve.
    setHistory((h) => [...h, { q, a: null }]);
    setQuestion("");

    try {
      const { data } = await problems.aiAsk(slugOrId, q);
      setHistory((h) => {
        const next = [...h];
        next[next.length - 1] = { q, a: data.reply || "(no reply)" };
        return next;
      });
    } catch (err) {
      const status = err?.response?.status;
      const msg = status === 429
        ? "You've hit the hourly AI limit (20/hr across all AI features). Take a breather and try again later."
        : err?.response?.data?.error || "Couldn't reach the companion. Try again.";
      setError(msg);
      // Drop the optimistic placeholder so it doesn't sit as an
      // empty bubble.
      setHistory((h) => h.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-reveal="up" className="mt-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="lamp-panel group flex w-full items-center gap-4 px-4 py-4 text-left transition hover:border-secondary/40 sm:px-5"
      >
        <motion.span
          aria-hidden="true"
          animate={open ? { rotate: 180, scale: 1.08 } : { rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/15 text-secondary shadow-[0_0_24px_-6px_rgb(var(--violet)/0.7)]"
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-text-primary">Stuck? Ask the companion</p>
          <p className="mt-1 text-sm leading-6 text-text-muted">
            Hints — not full solutions. The assistant knows this exact problem and steers you toward the answer.
          </p>
        </div>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.75}
          className={"h-5 w-5 shrink-0 transition-transform duration-300 " + (open ? "rotate-180 text-secondary" : "text-text-dim group-hover:text-secondary")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-[1.25rem] border border-secondary/25 bg-secondary/[0.05] p-4 sm:p-5">
              {history.length > 0 && (
                <div
                  ref={scrollRef}
                  className="mb-3 max-h-[420px] space-y-3 overflow-y-auto pr-1"
                >
                  {history.map((entry, i) => (
                    <Bubble key={i} entry={entry} thinking={busy && i === history.length - 1 && entry.a == null} />
                  ))}
                </div>
              )}

              <form onSubmit={onAsk} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={
                    history.length === 0
                      ? "e.g. I'm not sure how to parse the dataset — what should I look at first?"
                      : "Follow-up question…"
                  }
                  rows={2}
                  maxLength={2000}
                  className="min-h-[44px] flex-1 resize-y rounded-xl border border-[rgb(var(--rule))] bg-obsidian/50 px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-secondary/50 focus:outline-none"
                  onKeyDown={(e) => {
                    // Desktop convenience: Enter to submit (Shift+Enter
                    // for newline). On mobile, Enter on the on-screen
                    // keyboard is expected to insert a newline like in
                    // any chat app — submitting on Enter there is a
                    // foot-gun that loses unfinished questions. The
                    // (min-width: 640px) gate matches our `sm:` breakpoint.
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      typeof window !== "undefined" &&
                      window.matchMedia("(min-width: 640px)").matches
                    ) {
                      e.preventDefault();
                      onAsk(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={busy || !question.trim()}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-2 self-end rounded-xl bg-secondary px-4 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2} />
                  {busy ? "Thinking…" : "Ask"}
                </button>
              </form>

              {error && <p className="mt-2 text-xs text-danger">{error}</p>}

              <p className="mt-3 text-xs leading-5 text-text-dim">
                Companion is Socratic by design — it gives hints and pointers, not full solutions.
                Hourly limit: 20 questions per student across all AI features.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Bubble({ entry, thinking }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-1.5"
    >
      <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-secondary/20 px-3.5 py-2 text-sm text-text-primary">
        {entry.q}
      </div>
      <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-[rgb(var(--rule))] bg-surface/70 px-3.5 py-2 text-sm leading-6 text-text-primary/90">
        {thinking ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-dim">
            {[0, 1, 2].map((d) => (
              <motion.span
                key={d}
                className="h-1.5 w-1.5 rounded-full bg-secondary"
                animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
              />
            ))}
            <span className="ml-1">Thinking…</span>
          </span>
        ) : (
          <span className="whitespace-pre-wrap">{entry.a}</span>
        )}
      </div>
    </motion.div>
  );
}
