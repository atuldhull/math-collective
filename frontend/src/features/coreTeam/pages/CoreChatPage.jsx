import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, SendHorizontal, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { core } from "@/lib/api";
import { PageHeader } from "@/components/lamp";

/**
 * CoreChatPage — anonymous live chat for the core team.
 *
 * Every member posts; everyone reads it anonymously. Only the owner
 * account sees who actually sent each message (the backend decides
 * and sends `isOwner` + per-message `author`). Refreshes by polling
 * every 5s — simple and robust for a small team.
 */

function timeOf(d) {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CoreChatPage() {
  const [messages, setMessages] = useState(null);
  const [isOwner, setIsOwner]   = useState(false);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const scrollRef  = useRef(null);
  const atBottomRef = useRef(true);

  // AbortController so an in-flight fetch is cancelled when the
  // component unmounts or the poll is restarted. Prevents a "set
  // state after unmount" warning and saves a wasted Supabase hit if
  // the user navigates away mid-request.
  const abortRef = useRef(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { data } = await core.chatMessages({ signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setMessages(data.messages || []);
      setIsOwner(!!data.isOwner);
    } catch (err) {
      if (err?.name === "CanceledError" || err?.name === "AbortError") return;
      setMessages((m) => m || []);
    }
  }, []);

  useEffect(() => {
    // Visibility-paused poll. When the tab goes background we
    // clearInterval; when it comes back we run a catch-up load() and
    // restart the 5s loop. This stops a backgrounded /core/chat tab
    // from burning a /api/core/chat hit every 5 seconds — adds up
    // fast on a shared school IP behind the route limiter.
    let timer = null;
    const start = () => {
      load();
      timer = setInterval(load, 5000);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
      abortRef.current?.abort();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!timer) start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  // Keep the view pinned to the latest message unless the user has
  // scrolled up to read history.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const send = async () => {
    const body = input.trim();
    if (!body) return;
    setSending(true);
    try {
      await core.sendChatMessage(body);
      setInput("");
      atBottomRef.current = true;
      await load();
    } catch { /* surfaced on next poll */ }
    setSending(false);
  };

  const remove = async (id) => {
    try {
      await core.deleteChatMessage(id);
      setMessages((m) => m.filter((x) => x.id !== id));
    } catch { /* ignore */ }
  };

  if (!messages) {
    return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" label="Loading chat…" /></div>;
  }

  // dvh (vh fallback) because mobile 100vh includes the collapsed
  // URL-bar area, which pushes the composer below the visible viewport.
  return (
    <div className="flex flex-col">
      <PageHeader
        context="Core team"
        title="Team chat"
        size="sm"
        curve={false}
        className="!mb-5"
      >
        {/* anonymity banner */}
        <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-2.5 text-[13px] leading-5 ${
          isOwner
            ? "border-warning/30 bg-warning/10 text-warning"
            : "border-primary/25 bg-primary/10 text-primary"
        }`}>
          {isOwner
            ? <Eye className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            : <EyeOff className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />}
          {isOwner
            ? "Owner view — you can see who sent each message. Everyone else sees this chat anonymously."
            : "This chat is anonymous — no one can see who sent what. Speak freely."}
        </div>
      </PageHeader>

      <section className="lamp-panel flex h-[calc(100vh-19rem)] min-h-[360px] flex-col overflow-hidden supports-[height:100dvh]:h-[calc(100dvh-19rem)]">
        {/* messages */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          aria-live="polite"
          className="relative flex-1 space-y-3 overflow-y-auto p-4 sm:p-5"
        >
          {messages.length === 0 && (
            <p className="py-12 text-center text-sm text-text-dim">No messages yet — say something.</p>
          )}
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                layout="position"
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                style={{ transformOrigin: m.mine ? "100% 100%" : "0% 100%" }}
                className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
              >
                <div className={`group max-w-[85%] rounded-2xl border px-4 py-2.5 sm:max-w-[75%] ${
                  m.mine
                    ? "rounded-br-md border-primary/30 bg-primary/[0.13]"
                    : "rounded-bl-md border-[rgb(var(--rule))] bg-white/[0.04]"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-[12px] font-medium ${m.mine ? "text-primary" : "text-text-muted"}`}>
                      {m.mine ? "You" : (m.author || "Anonymous")}
                    </span>
                    <span className="lamp-numerals text-[11px] text-text-dim">{timeOf(m.created_at)}</span>
                    {isOwner && (
                      <button
                        onClick={() => remove(m.id)}
                        aria-label="Delete message"
                        className="-m-1 ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-text-dim transition hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-text-primary">{m.body}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* composer */}
        <div className="flex gap-2 border-t border-[rgb(var(--rule))] bg-surface/60 p-3">
          <input
            aria-label="Message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type anonymously…"
            maxLength={1000}
            className="min-w-0 flex-1 rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/50"
          />
          <Button size="md" variant="primary" magnetic={false} loading={sending} onClick={send} leading={<SendHorizontal className="h-4 w-4" strokeWidth={1.75} />}>
            Send
          </Button>
        </div>
      </section>
    </div>
  );
}
