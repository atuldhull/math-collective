import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { bot } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { RotateCcw, SendHorizontal } from "lucide-react";
import { useIsLamplight } from "@/components/lamp/SkinProvider";
import PandaMark from "./PandaMark";

// Minimal, safe markdown → HTML renderer for PANDA replies.
// Order matters:
//   1. HTML-escape the raw text so an LLM-generated "<script>" can't
//      reach the DOM via dangerouslySetInnerHTML.
//   2. Convert [label](url) first — we rely on the matched url being
//      intact; doing bare-URL autolinking before this would double-
//      anchor the href.
//   3. Autolink any remaining bare http(s):// URLs.
//   4. Bold, inline code, and line breaks last.
const LINK_CLASS =
  'text-[#00FFC8] underline underline-offset-2 break-words hover:brightness-125';
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const LAMP_LINK_CLASS =
  'text-primary underline decoration-[rgb(var(--lamp)/0.4)] underline-offset-2 break-words hover:decoration-[rgb(var(--lamp))]';
function renderMd(text, lamp = false) {
  const linkClass = lamp ? LAMP_LINK_CLASS : LINK_CLASS;
  let html = escapeHtml(text);
  // [label](https://url) — the common case for tool-cited papers.
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, label, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="${linkClass}">${label}</a>`,
  );
  // Bare URLs not already wrapped by the step above. Negative lookbehind
  // via the leading group: only match when the url isn't preceded by `"`
  // or `=` (which would mean it's already inside an href attribute).
  html = html.replace(
    /(^|[^"=])(https?:\/\/[^\s<]+)/g,
    (_, prefix, url) =>
      `${prefix}<a href="${url}" target="_blank" rel="noopener noreferrer" class="${linkClass}">${url}</a>`,
  );
  html = html
    .replace(/\*\*(.*?)\*\*/g, lamp ? '<strong class="font-semibold text-text-primary">$1</strong>' : '<strong class="text-white">$1</strong>')
    .replace(/`(.*?)`/g, lamp
      ? '<code class="rounded bg-[rgb(var(--lamp)/0.12)] px-1 py-0.5 font-mono text-[12px] text-primary">$1</code>'
      : '<code class="rounded bg-[rgba(0,255,200,0.1)] px-1 py-0.5 font-mono text-[11px] text-[#00FFC8]">$1</code>')
    .replace(/\n/g, "<br/>");
  return html;
}

export default function PandaChatPanel({ open, onClose, launcherRef }) {
  // The /api/bot/chat endpoint requires auth (added during the Phase 8
  // security pass — bot was a public abuse vector against our OpenRouter
  // credits). So we need to know who's logged in to give a useful UX.
  const lamp    = useIsLamplight();
  const status  = useAuthStore((s) => s.status);
  const isGuest = status === "guest" || status === "error";

  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hey! I'm **PANDA** 🐼 your math AI.\n\nAsk me about Calculus, Algebra, Probability — anything!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open && !isGuest) setTimeout(() => inputRef.current?.focus(), 400);
  }, [open, isGuest]);

  // Click-outside-to-close + Escape-to-close. We listen on document
  // mousedown so the panel closes BEFORE any click handler on the
  // background can fire — otherwise clicking, say, the "ARENA" nav link
  // while the panel was open would navigate AND leave the panel open.
  // The launcher button is excluded from "outside" because the parent
  // already toggles via its own onClick.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (!panelRef.current) return;
      if (panelRef.current.contains(e.target)) return;
      if (launcherRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, launcherRef]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const updated = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const { data } = await bot.chat(updated.map((m) => ({ role: m.role, content: m.content })));
      setMessages([...updated, { role: "assistant", content: data.reply }]);
    } catch (err) {
      // Distinguish 401 (session expired / not logged in) from a real outage.
      const code = err?.response?.status;
      let reply;
      if (code === 401) {
        reply = "You need to **sign in** to chat with me — head to the login page and come back. \uD83D\uDC3C";
      } else if (code === 413 || code === 400) {
        reply = "That message is too long for me to chew on \uD83D\uDC3C\u2014 try a shorter question?";
      } else if (code === 429) {
        reply = "I'm getting too many questions right now \uD83D\uDC3C\u2014 give me a minute and try again.";
      } else {
        reply = "PANDA is napping \uD83D\uDE34 Try again in a moment!";
      }
      setMessages([...updated, { role: "assistant", content: reply }]);
    }
    setLoading(false);
  };

  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  // ── Lamplight skin ─────────────────────────────────────────────
  // Same state and handlers; the panel unfolds from the launcher's corner
  // (transform-origin bottom right) and each reply settles in like a card
  // laid on the desk.
  if (lamp) {
    const canSend = Boolean(input.trim()) && !loading;
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 28, scale: 0.9, rotateX: 10 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 24, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            role="dialog"
            aria-label="PANDA math assistant"
            className="lamp-float-panel fixed rounded-[1.25rem] border border-[rgb(var(--lamp)/0.28)] bg-[rgb(var(--color-surface)/0.94)] bg-[radial-gradient(120%_70%_at_100%_0%,rgb(var(--lamp)/0.12),transparent_55%)] backdrop-blur-xl bottom-[96px] right-3 z-50 flex flex-col overflow-hidden shadow-[0_40px_100px_-30px_rgba(0,0,0,0.85),0_0_60px_-30px_rgb(var(--lamp)/0.6)] sm:bottom-[100px] sm:right-6"
            style={{
              width: "min(420px, calc(100vw - 1.5rem))",
              height: "min(600px, calc(100dvh - 8rem))",
              transformOrigin: "100% 100%",
              transformPerspective: 1000,
              overscrollBehavior: "contain",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-[rgb(var(--rule))] px-4 py-3 sm:px-5">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[rgb(var(--lamp)/0.3)] bg-[rgb(var(--color-obsidian)/0.6)]">
                <PandaMark size={30} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="lamp-display truncate text-[17px] text-text-primary">Panda</p>
                <p className="flex items-center gap-1.5 text-[12px] text-text-muted">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
                    <span className="relative h-2 w-2 rounded-full bg-success" />
                  </span>
                  Math assistant, online
                </p>
              </div>
              <button
                onClick={() => setMessages([{ role: "assistant", content: "Clean slate! 🐼 What shall we solve?" }])}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[13px] text-text-muted transition hover:bg-[rgb(var(--lamp)/0.08)] hover:text-text-primary"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Clear
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4" style={{ overscrollBehavior: "contain" }}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 14, rotateX: -30 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  style={{ transformOrigin: "50% 0%", transformPerspective: 600 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start gap-2"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[rgb(var(--rule))] bg-[rgb(var(--color-obsidian)/0.5)]">
                      <PandaMark size={20} blink={false} />
                    </div>
                  )}
                  <div
                    className={
                      msg.role === "user"
                        ? "max-w-[85%] break-words rounded-2xl rounded-br-md border border-[rgb(var(--lamp)/0.3)] bg-[rgb(var(--lamp)/0.14)] px-3.5 py-2.5 text-[14px] leading-relaxed text-text-primary"
                        : "max-w-[85%] break-words rounded-2xl rounded-bl-md border border-[rgb(var(--rule))] bg-panel/80 px-3.5 py-2.5 text-[14px] leading-relaxed text-text-muted"
                    }
                    dangerouslySetInnerHTML={{ __html: renderMd(msg.content, true) }}
                  />
                </motion.div>
              ))}

              {/* Typing indicator — the asymptote's dot, three times over */}
              {loading && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2" aria-live="polite">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[rgb(var(--rule))] bg-[rgb(var(--color-obsidian)/0.5)]">
                    <PandaMark size={20} blink={false} />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-[rgb(var(--rule))] bg-panel/80 px-4 py-3">
                    <span className="sr-only">Panda is thinking</span>
                    {[0, 0.15, 0.3].map((d, idx) => (
                      <motion.span key={idx} animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: d }}
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {!isGuest && messages.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 border-t border-[rgb(var(--rule))] px-3 py-2.5 sm:px-4">
                {["Explain derivatives", "What is a matrix?", "Probability basics"].map((q, i) => (
                  <motion.button
                    key={q}
                    onClick={() => setInput(q)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.06 }}
                    className="min-h-9 rounded-full border border-[rgb(var(--rule))] bg-surface/60 px-3 text-[12px] text-text-muted transition hover:border-[rgb(var(--lamp)/0.45)] hover:text-text-primary"
                  >
                    {q}
                  </motion.button>
                ))}
              </div>
            )}

            <div className="border-t border-[rgb(var(--rule))] px-3 py-3 sm:px-4">
              {isGuest ? (
                <div className="flex flex-col items-center gap-2.5 py-2 text-center">
                  <p className="text-[13px] text-text-muted">Sign in to chat with Panda.</p>
                  <Link
                    to="/login"
                    className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-[13px] font-semibold text-[rgb(var(--color-obsidian))] shadow-[0_10px_30px_-12px_rgb(var(--lamp)/0.75)] transition hover:brightness-110"
                  >
                    Sign in
                  </Link>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Ask Panda about any maths problem"
                    aria-label="Message Panda"
                    rows={1}
                    className="max-h-24 min-h-[44px] flex-1 resize-none rounded-xl border border-[rgb(var(--rule))] bg-[rgb(var(--color-obsidian)/0.6)] px-3.5 py-2.5 text-[14px] text-text-primary outline-none transition placeholder:text-text-dim focus:border-[rgb(var(--lamp)/0.5)] focus:shadow-[0_0_0_3px_rgb(var(--lamp)/0.12)]"
                  />
                  <motion.button
                    onClick={send}
                    disabled={!canSend}
                    whileTap={canSend ? { scale: 0.9 } : undefined}
                    aria-label="Send"
                    className={
                      "grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-[background-color,color,box-shadow] duration-300 disabled:cursor-not-allowed " +
                      (canSend
                        ? "bg-primary text-[rgb(var(--color-obsidian))] shadow-[0_10px_26px_-10px_rgb(var(--lamp)/0.85)]"
                        : "bg-surface/70 text-text-dim")
                    }
                  >
                    <SendHorizontal className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="lamp-float-panel fixed bottom-[96px] right-3 z-50 flex flex-col overflow-hidden sm:bottom-[100px] sm:right-6"
          style={{
            // Dynamic viewport units (100dvh) subtract the mobile
            // browser's address bar / bottom chrome, so the chat panel
            // doesn't get clipped below the fold on iOS Safari. Width
            // now clamps aggressively on small viewports so it never
            // exceeds the screen minus a small gutter.
            width: "min(420px, calc(100vw - 1.5rem))",
            height: "min(600px, calc(100dvh - 8rem))",
            clipPath: "var(--clip-notch)",
            background: "rgba(0, 10, 20, 0.92)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(0,255,200,0.2)",
            borderTop: "2px solid var(--monument-abyss)",
            boxShadow: "0 25px 80px rgba(0,0,0,0.6), 0 0 30px rgba(0,255,200,0.1)",
            // overscroll-behavior: contain stops a wheel/touch scroll on
            // the chat panel from "leaking" to the page beneath when the
            // inner scroll hits its top/bottom edge. With this, hovering
            // the panel and scrolling moves the chat history only; the
            // dashboard doesn't lurch underneath.
            overscrollBehavior: "contain",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{
              background: "rgba(0,255,200,0.05)",
              borderBottom: "1px solid rgba(0,255,200,0.15)",
            }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
              style={{ background: "rgba(0,255,200,0.1)", border: "1px solid rgba(0,255,200,0.2)" }}
            >
              🐼
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="math-text text-sm" style={{ color: "var(--monument-abyss)" }}>∞</span>
                <span className="text-sm font-semibold text-white">PANDA — Math Intelligence Unit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full shadow-[0_0_4px_rgba(0,255,200,0.5)]" style={{ background: "var(--monument-abyss)" }} />
                <span className="font-mono text-[10px] text-white/40">Online</span>
              </div>
            </div>
            <button onClick={() => setMessages([{ role: "assistant", content: "Clean slate! 🐼 What shall we solve?" }])}
              className="rounded-lg px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider text-white/30 transition hover:bg-[rgba(0,255,200,0.08)] hover:text-white/60">
              Clear
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4 [scrollbar-width:thin] [scrollbar-color:rgba(0,255,200,0.15)_transparent]"
            style={{ overscrollBehavior: "contain" }}
          >
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start gap-2"}`}
              >
                {msg.role === "assistant" && (
                  <div
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs"
                    style={{ background: "rgba(0,255,200,0.1)" }}
                  >
                    🐼
                  </div>
                )}
                <div
                  className="max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed"
                  style={
                    msg.role === "user"
                      ? {
                          clipPath: "var(--clip-para)",
                          background: "rgba(0,255,200,0.2)",
                          borderLeft: "2px solid var(--monument-abyss)",
                          color: "rgba(255,255,255,0.9)",
                        }
                      : {
                          clipPath: "var(--clip-notch)",
                          background: "rgba(0,20,40,0.8)",
                          border: "1px solid rgba(0,255,200,0.15)",
                          color: "rgba(255,255,255,0.6)",
                        }
                  }
                  dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }}
                />
              </motion.div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-2">
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs"
                  style={{ background: "rgba(0,255,200,0.1)" }}
                >
                  🐼
                </div>
                <div
                  className="flex items-center gap-2 px-4 py-3"
                  style={{
                    clipPath: "var(--clip-notch)",
                    background: "rgba(0,20,40,0.8)",
                    border: "1px solid rgba(0,255,200,0.15)",
                  }}
                >
                  {[0, 0.15, 0.3].map((d, idx) => (
                    <motion.span key={idx} animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: d }}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--monument-abyss)" }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Quick suggestion chips — only useful when the user can actually
              send a message. Hide for guests since the input below is replaced
              with a sign-in CTA. */}
          {!isGuest && messages.length <= 1 && (
            <div
              className="flex flex-wrap gap-1.5 px-4 py-2.5"
              style={{ borderTop: "1px solid rgba(0,255,200,0.1)" }}
            >
              {["Explain derivatives", "What is a matrix?", "Probability basics"].map((q) => (
                <button key={q} onClick={() => setInput(q)}
                  className="font-mono text-[10px] transition"
                  style={{
                    clipPath: "var(--clip-para)",
                    background: "rgba(0,255,200,0.08)",
                    border: "1px solid rgba(0,255,200,0.3)",
                    color: "var(--monument-abyss)",
                    padding: "0.35rem 0.75rem",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,255,200,0.18)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,255,200,0.08)"; }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input — replaced with a sign-in CTA when the user is a guest. */}
          <div style={{ borderTop: "1px solid rgba(0,255,200,0.15)" }} className="px-4 py-3">
            {isGuest ? (
              <div className="flex flex-col items-center gap-2 py-2 text-center">
                <p className="text-[12px] text-white/60">
                  Sign in to chat with PANDA <span aria-hidden>{"\u{1F43C}"}</span>
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition hover:brightness-110"
                  style={{
                    background: "var(--monument-abyss)",
                    color: "#000",
                    clipPath: "var(--clip-para)",
                  }}
                >
                  Sign in
                </Link>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Ask PANDA anything..."
                  rows={1}
                  className="max-h-24 min-h-[42px] flex-1 resize-none px-3.5 py-2.5 text-[13px] text-white outline-none placeholder:text-white/20"
                  style={{
                    background: "rgba(0,20,40,0.6)",
                    border: "1px solid rgba(0,255,200,0.15)",
                    borderBottom: "1.5px solid rgba(0,255,200,0.3)",
                    borderLeft: "3px solid var(--monument-abyss)",
                  }}
                />
                {/* Send button — hex shaped */}
                <motion.button
                  onClick={send}
                  disabled={!input.trim() || loading}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  className="flex shrink-0 items-center justify-center transition disabled:opacity-20"
                  style={{
                    width: 40,
                    height: 40,
                    clipPath: "var(--clip-hex)",
                    background: input.trim() && !loading ? "var(--monument-abyss)" : "rgba(0,255,200,0.1)",
                    color: input.trim() && !loading ? "#000" : "rgba(255,255,255,0.3)",
                  }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
