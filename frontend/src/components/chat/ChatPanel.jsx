/**
 * ChatPanel — Slide-out messaging panel (like Instagram DMs).
 *
 * Accessible from any page via a floating button.
 * Features:
 *   - Conversation list with unread counts
 *   - Real-time messaging via Socket.IO
 *   - E2EE encryption/decryption
 *   - User search to start new conversations
 *   - Typing indicators + read receipts
 *   - Friend request management
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import { chat } from "@/lib/api";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import { useAuthStore } from "@/store/auth-store";
import { useIdentityStore } from "@/store/identity-store";
import Button from "@/components/ui/Button";
import UserHoverCard from "@/components/social/UserHoverCard";
import IdentityGlyph from "@/components/identity/IdentityGlyph";
import { ArrowLeft, CheckCheck, Lock, MessagesSquare, Search, SendHorizontal, UserPlus, X } from "lucide-react";
import { useIsLamplight } from "@/components/lamp/SkinProvider";
import { cn } from "@/lib/cn";

// ═══════════════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════════════

const VIEW = { LIST: "list", CHAT: "chat", SEARCH: "search", REQUESTS: "requests" };

// ═══════════════════════════════════════════════════════════
// MAIN PANEL
// ═══════════════════════════════════════════════════════════

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   initialPeerUserId?: string | null,
 *   onTargetConsumed?: () => void,
 * }} props
 *
 * `initialPeerUserId` — when set and the panel opens, auto-navigate
 * to that user's 1-to-1 conversation (creating it if needed). Used
 * by Phase-15 MessageButton on profiles and hovercards. After the
 * navigation fires we call `onTargetConsumed` so the caller can
 * reset the ui-store target and subsequent re-renders don't re-
 * trigger the navigation.
 */
export default function ChatPanel({ open, onClose, initialPeerUserId = null, onTargetConsumed }) {
  const user = useAuthStore((s) => s.user);
  const lamp = useIsLamplight();
  // Identity is our source of truth for E2EE. If it's not "ready",
  // encrypt/decrypt will throw. ChatPanel reads the CryptoKey + sigil
  // directly and hands them to the crypto lib. The ceremony modal
  // (mounted in ExperienceShell via IdentityModalsRoot) handles the
  // "not yet forged" case — this component just checks the gate.
  const identityStatus     = useIdentityStore((s) => s.status);
  const myPrivateKey       = useIdentityStore((s) => s.privateKey);
  const mySigil            = useIdentityStore((s) => s.sigil);
  const serverSyncError    = useIdentityStore((s) => s.serverSyncError);
  const retryServerSync    = useIdentityStore((s) => s.retryServerSync);
  const [view, setView] = useState(VIEW.LIST);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [typing, setTyping] = useState(null);
  const [peerKey, setPeerKey] = useState(null);
  // User-facing error for the active conversation (peer has no key,
  // encryption failed, send failed, etc.). Cleared when the user
  // switches conversations or types something new.
  const [chatError, setChatError] = useState(null);
  const scrollRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeout = useRef(null);

  // ── Initialize Socket.IO ──
  //
  // Public-key registration has moved to the identity store's
  // hydrate() path — it re-publishes on every app boot. No need
  // to re-register here. The store also exposes `myPrivateKey`,
  // which we pass through to encryptMessage / decryptMessage
  // (they used to fetch it themselves via getOrCreateKeyPair,
  // which no longer exists).
  useEffect(() => {
    if (!user?.id || !open) return;

    // Socket.IO for real-time
    const socket = io(window.location.origin, { withCredentials: true, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("register_user", user.id));

    socket.on("chat:receive", async (msg) => {
      // Normalise socket payload (camelCase) to the snake_case shape
      // the rest of this component + the DB use. Without this the
      // renderer reads `msg.sender_id` / `msg.created_at` off a
      // spread that only has `senderId` / `createdAt` → alignment
      // breaks and timestamps render as "Invalid Date".
      const normalised = {
        conversation_id:   msg.conversationId,
        sender_id:         msg.senderId,
        encrypted_content: msg.encryptedContent,
        iv:                msg.iv,
        message_type:      msg.messageType,
        created_at:        msg.createdAt,
      };
      if (normalised.conversation_id === activeConv?.id) {
        try {
          if (!myPrivateKey) throw new Error("identity not ready");
          const senderKey = await chat.getKey(normalised.sender_id);
          const decrypted = await decryptMessage(normalised.encrypted_content, normalised.iv, senderKey.data.publicKey, myPrivateKey);
          setMessages((prev) => [...prev, { ...normalised, content: decrypted, decrypted: true }]);
          chat.markAsRead(normalised.conversation_id).catch(() => {});
        } catch {
          setMessages((prev) => [...prev, { ...normalised, content: "[Encrypted]", decrypted: false }]);
        }
      }
      loadConversations();
    });

    socket.on("chat:typing", ({ conversationId, userId }) => {
      if (conversationId === activeConv?.id) {
        setTyping(userId);
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTyping(null), 3000);
      }
    });

    socket.on("chat:read", ({ conversationId }) => {
      if (conversationId === activeConv?.id) {
        setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
      }
    });

    return () => { socket.disconnect(); socketRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, open, activeConv?.id, myPrivateKey]);

  // ── Load conversations ──
  const loadConversations = useCallback(async () => {
    try {
      const { data } = await chat.getConversations();
      setConversations(data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (open) loadConversations(); }, [open, loadConversations]);

  // Phase 15 — auto-navigate to a target user's conversation when
  // the panel was opened with an initialPeerUserId (via MessageButton).
  // We gate on `open` so a stale prop doesn't trigger navigation
  // while the panel is closed, and call onTargetConsumed() after so
  // re-renders don't loop.
  useEffect(() => {
    if (!open || !initialPeerUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: conv } = await chat.getOrCreateConversation(initialPeerUserId);
        if (cancelled) return;
        await loadConversations();
        if (cancelled) return;
        openConversation(conv);
      } catch {
        // Silent — the panel still opens to the list view, which is a
        // reasonable fallback when the user can't be messaged (blocked,
        // settings=nobody). MessageButton itself is disabled in those
        // cases, so hitting this path is rare.
      } finally {
        if (!cancelled) onTargetConsumed?.();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPeerUserId]);

  // ── Load messages for active conversation ──
  const loadMessages = useCallback(async (conv) => {
    setChatError(null);
    try {
      const { data: msgs } = await chat.getMessages(conv.id);
      const otherId = conv.participant_a === user.id ? conv.participant_b : conv.participant_a;

      // Get peer's public key for decryption. 404 here means the peer
      // has never registered a public key with the server — either they
      // never completed the Identity Ceremony, or their first registerKey
      // POST failed silently. Merely "opening chat" doesn't trigger a
      // ceremony, so the old copy ("ask them to open chat at least once")
      // was misleading. Tell the peer what to actually do.
      let keyData;
      try {
        ({ data: keyData } = await chat.getKey(otherId));
      } catch (err) {
        if (err?.response?.status === 404) {
          setChatError(
            "This user hasn't finished their identity setup yet. " +
            "Ask them to open their Profile → Identity panel and complete the " +
            "12-word ceremony — that's what registers their encryption key.",
          );
          setPeerKey(null);
          setMessages([]);
          return;
        }
        throw err;
      }
      setPeerKey(keyData.publicKey);

      // Decrypt messages. Requires the identity store to be "ready"
      // (myPrivateKey available) — without it we render a placeholder
      // so the UI explains WHY rather than silently failing.
      const decrypted = await Promise.all(
        (msgs || []).reverse().map(async (m) => {
          try {
            if (!myPrivateKey) throw new Error("identity not ready");
            const senderKeyId = m.sender_id === user.id ? otherId : m.sender_id;
            const { data: sk } = await chat.getKey(senderKeyId);
            const content = await decryptMessage(m.encrypted_content, m.iv, sk.publicKey, myPrivateKey);
            return { ...m, content, decrypted: true };
          } catch {
            return { ...m, content: "[Cannot decrypt]", decrypted: false };
          }
        }),
      );

      setMessages(decrypted);
      chat.markAsRead(conv.id).catch(() => {});
    } catch (err) {
      setChatError(err?.response?.data?.error || "Couldn't load messages — check your connection.");
    }
  }, [user?.id, myPrivateKey]);

  // ── Open a conversation ──
  const openConversation = useCallback(async (conv) => {
    setActiveConv(conv);
    setView(VIEW.CHAT);
    await loadMessages(conv);
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 100);
  }, [loadMessages]);

  // ── Send message ──
  const handleSend = async () => {
    if (!input.trim() || !activeConv || sending) return;
    if (!peerKey) {
      setChatError("This user hasn't set up end-to-end encryption yet.");
      return;
    }
    if (!myPrivateKey) {
      setChatError("Forge your identity first (open chat, click Forge My Identity).");
      return;
    }
    setChatError(null);
    setSending(true);
    const text = input.trim();
    setInput("");

    try {
      const { encrypted, iv } = await encryptMessage(text, peerKey, myPrivateKey);
      const otherId = activeConv.participant_a === user.id ? activeConv.participant_b : activeConv.participant_a;

      // Save to DB
      await chat.sendMessage(activeConv.id, encrypted, iv, "text");

      // Push via Socket.IO for real-time
      socketRef.current?.emit("chat:send", {
        conversationId: activeConv.id,
        recipientId: otherId,
        encryptedContent: encrypted,
        iv,
        messageType: "text",
      });

      // Add to local messages immediately
      setMessages((prev) => [...prev, {
        sender_id: user.id,
        content: text,
        decrypted: true,
        created_at: new Date().toISOString(),
      }]);

      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 50);
    } catch (err) {
      setInput(text); // restore input on failure
      setChatError(err?.response?.data?.error || "Couldn't send — try again.");
    }
    setSending(false);
  };

  // ── Typing indicator ──
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (chatError) setChatError(null);
    if (activeConv && socketRef.current) {
      const otherId = activeConv.participant_a === user.id ? activeConv.participant_b : activeConv.participant_a;
      socketRef.current.emit("chat:typing", { conversationId: activeConv.id, recipientId: otherId });
    }
  };

  // ── Search users ──
  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await chat.searchUsers(q);
      setSearchResults(data || []);
    } catch { setSearchResults([]); }
  };

  // ── Start conversation with searched user ──
  const startChat = async (otherUserId) => {
    try {
      const { data: conv } = await chat.getOrCreateConversation(otherUserId);
      await loadConversations();
      openConversation(conv);
    } catch (err) {
      alert(err.response?.data?.error || "Cannot start conversation");
    }
  };

  // ── Load friend requests ──
  const loadRequests = async () => {
    try {
      const { data } = await chat.getPending();
      setPendingRequests(data || []);
    } catch { /* ignore */ }
  };

  if (!open) return null;

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  // Skin switch: `t(lampClasses, legacyClasses)`. The home page keeps the
  // original look; every other route wears Lamplight.
  const t = (a, b) => (lamp ? a : b);
  const iconBtn = t(
    "grid h-10 w-10 place-items-center rounded-xl text-text-dim transition hover:bg-[rgb(var(--lamp)/0.08)] hover:text-text-primary",
    "rounded-lg p-1.5 text-text-dim hover:bg-white/5 hover:text-white",
  );
  const fieldCls = t(
    "w-full rounded-xl border border-[rgb(var(--rule))] bg-[rgb(var(--color-obsidian)/0.6)] px-3.5 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-[rgb(var(--lamp)/0.5)] focus:shadow-[0_0_0_3px_rgb(var(--lamp)/0.12)]",
    "w-full rounded-xl border border-line/15 bg-black/15 px-3 py-2 text-sm text-white outline-none focus:border-primary/30",
  );
  const rowCard = t(
    "flex items-center gap-3 rounded-2xl border border-[rgb(var(--rule))] bg-surface/50 px-3 py-2.5",
    "flex items-center gap-3 rounded-xl border border-line/10 bg-black/10 px-3 py-2.5",
  );
  // Lamplight: each view slides in from the side it logically lives on.
  const viewMotion = lamp
    ? {
        initial: { opacity: 0, x: view === VIEW.LIST ? -24 : 24 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
      }
    : { initial: false };
  const listStagger = (i) =>
    lamp
      ? {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: Math.min(i, 10) * 0.035, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
        }
      : {};

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 250 }}
        className={t(
          "fixed inset-y-0 left-0 z-[60] flex h-full w-full flex-col overflow-hidden border-r border-[rgb(var(--rule))] bg-[rgb(var(--color-surface)/0.96)] shadow-[30px_0_80px_-40px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:inset-y-3 sm:left-3 sm:h-auto sm:w-[400px] sm:rounded-[1.25rem] sm:border",
          "fixed left-0 top-0 z-[60] flex h-full w-full flex-col border-r border-line/10 bg-surface/95 backdrop-blur-2xl sm:w-[400px]",
        )}
      >
        {lamp ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(closest-side,rgb(var(--lamp)/0.18),transparent)]"
          />
        ) : null}

        {/* ── Header ── */}
        <div className={t("relative flex items-center justify-between gap-2 border-b border-[rgb(var(--rule))] px-3 py-2.5 sm:px-4", "flex items-center justify-between border-b border-line/10 px-4 py-3")}>
          {view === VIEW.CHAT ? (
            <button onClick={() => { setView(VIEW.LIST); setActiveConv(null); }} className={t("flex min-h-10 min-w-0 items-center gap-2.5 rounded-xl pr-2 text-sm text-text-muted transition hover:text-text-primary", "flex items-center gap-2 text-sm text-text-muted hover:text-white")}>
              {lamp ? <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" /> : <span>←</span>}
              {/* Peer's identity glyph — the "is this still the same person?"
                  visual. A sudden change mid-conversation is a signal that
                  the peer rotated keys. */}
              {activeConv?.otherUser?.user_id && (
                <IdentityGlyph userId={activeConv.otherUser.user_id} size={22} inline />
              )}
              <span className={t("truncate font-medium text-text-primary", undefined)}>{activeConv?.otherUser?.name || "Back"}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {/* My own sigil — always visible in the list view header so
                  the user gets used to seeing their mathematical self. */}
              {mySigil && identityStatus === "ready" && (
                <IdentityGlyph sigil={mySigil} size={22} inline title="Your identity" />
              )}
              <h3 className={t("lamp-display flex items-center text-lg text-text-primary", "font-display text-sm font-semibold text-white")}>
                {view === VIEW.SEARCH && lamp ? "Find people" : view === VIEW.REQUESTS && lamp ? "Friend requests" : "Messages"}{" "}
                {totalUnread > 0 && (
                  <span className={t("lamp-numerals ml-2 inline-grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] text-[rgb(var(--color-obsidian))]", "ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-white")}>
                    {totalUnread}
                  </span>
                )}
              </h3>
            </div>
          )}
          <div className={t("flex items-center gap-0.5", "flex items-center gap-2")}>
            {view === VIEW.LIST && (
              <>
                <button onClick={() => { setView(VIEW.SEARCH); }} className={iconBtn} title="New chat" aria-label="New chat">
                  {lamp ? <Search className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" /> : <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>}
                </button>
                <button onClick={() => { setView(VIEW.REQUESTS); loadRequests(); }} className={iconBtn} title="Friend requests" aria-label="Friend requests">
                  {lamp ? <UserPlus className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" /> : <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
                </button>
              </>
            )}
            <button onClick={onClose} className={iconBtn} aria-label="Close chat panel">
              {lamp ? <X className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" /> : <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
            </button>
          </div>
        </div>

        {/* ── Server sync banner ── */}
        {identityStatus === "ready" && serverSyncError && (
          <div className={t("relative border-b border-warning/20 bg-warning/10 px-4 py-2.5 text-[12px] text-warning", "border-b border-warning/20 bg-warning/10 px-4 py-2 text-[11px] text-warning")}>
            <div className="flex items-center justify-between gap-2">
              <span>Key not synced to server — others can&apos;t message you until this succeeds.</span>
              <button
                onClick={() => retryServerSync()}
                className={t("min-h-8 shrink-0 rounded-lg border border-warning/40 px-2.5 text-[12px] font-medium hover:bg-warning/20", "rounded border border-warning/40 px-2 py-0.5 text-[10px] uppercase tracking-wider hover:bg-warning/20")}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <motion.div key={view} {...viewMotion} className="relative flex min-h-0 flex-1 flex-col">
        {/* ── Conversation List ── */}
        {view === VIEW.LIST && (
          <div className={t("flex-1 overflow-y-auto overscroll-contain p-2", "flex-1 overflow-y-auto")}>
            {conversations.length === 0 ? (
              lamp ? (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[rgb(var(--lamp)/0.3)] bg-[rgb(var(--lamp)/0.08)] text-primary">
                    <MessagesSquare className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <p className="lamp-display text-lg text-text-primary">No conversations yet</p>
                  <p className="max-w-[30ch] text-sm text-text-muted">Find a classmate by name or email and say hello.</p>
                  <Button size="sm" variant="secondary" className="mt-1" onClick={() => setView(VIEW.SEARCH)}>
                    Find people
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-2xl">💬</p>
                  <p className="mt-3 text-sm text-text-muted">No conversations yet</p>
                  <Button size="sm" variant="secondary" className="mt-3" onClick={() => setView(VIEW.SEARCH)}>
                    Find people
                  </Button>
                </div>
              )
            ) : (
              conversations.map((conv, i) => (
                <motion.button
                  key={conv.id}
                  {...listStagger(i)}
                  onClick={() => openConversation(conv)}
                  className={t(
                    "group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[rgb(var(--lamp)/0.06)]",
                    "flex w-full items-center gap-3 border-b border-line/5 px-4 py-3 text-left transition hover:bg-white/[0.03]",
                  )}
                >
                  <div
                    className={t("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ring-1 ring-[rgb(var(--rule))] transition group-hover:ring-[rgb(var(--lamp)/0.45)]", "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg")}
                    style={{ background: conv.otherUser?.avatar_color || "var(--color-avatar-fallback)" }}
                  >
                    {conv.otherUser?.avatar_emoji || conv.otherUser?.name?.charAt(0) || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={t("truncate text-sm font-medium text-text-primary", "truncate text-sm font-medium text-white")}>
                      {conv.otherUser?.user_id
                        ? <UserHoverCard userId={conv.otherUser.user_id}>{conv.otherUser?.name || "User"}</UserHoverCard>
                        : (conv.otherUser?.name || "User")}
                    </p>
                    <p className={t("truncate text-[12px] text-text-dim", "truncate text-xs text-text-dim")}>{conv.otherUser?.title || "Student"}</p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className={t("lamp-numerals flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] text-[rgb(var(--color-obsidian))] shadow-[0_0_14px_rgb(var(--lamp)/0.6)]", "flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white")}>
                      {conv.unreadCount}
                    </span>
                  )}
                </motion.button>
              ))
            )}
          </div>
        )}

        {/* ── Chat View ── */}
        {view === VIEW.CHAT && (
          <>
            <div ref={scrollRef} className={t("flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4", "flex-1 space-y-2 overflow-y-auto px-4 py-3")}>
              {messages.map((msg, i) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <motion.div
                    key={msg.id || i}
                    initial={lamp ? { opacity: 0, y: 10, scale: 0.97 } : false}
                    animate={lamp ? { opacity: 1, y: 0, scale: 1 } : undefined}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    style={lamp ? { transformOrigin: isMine ? "100% 100%" : "0% 100%" } : undefined}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={lamp
                        ? cn(
                            "min-w-0 max-w-[82%] break-words px-3.5 py-2 text-[14px] leading-relaxed",
                            isMine
                              ? "rounded-2xl rounded-br-md border border-[rgb(var(--lamp)/0.28)] bg-[rgb(var(--lamp)/0.14)] text-text-primary"
                              : "rounded-2xl rounded-bl-md border border-[rgb(var(--rule))] bg-panel/80 text-text-primary",
                            !msg.decrypted && "italic text-text-dim",
                          )
                        : `min-w-0 max-w-[80%] break-words px-3 py-2 text-[13px] leading-relaxed ${
                            isMine
                              ? "rounded-2xl rounded-br-sm bg-primary/20 text-white"
                              : "rounded-2xl rounded-bl-sm bg-white/[0.05] text-text-muted"
                          }`}
                    >
                      {msg.content}
                      <span className={t("mt-0.5 flex items-center justify-end gap-1 text-[10px] text-text-dim", "mt-0.5 block text-right text-[9px] text-text-dim")}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        {isMine && msg.is_read && (lamp ? <CheckCheck className="h-3 w-3 text-primary" strokeWidth={2} aria-label="Read" /> : " ✓✓")}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              {typing && (lamp ? (
                <div className="flex items-center gap-2 pl-1 text-[12px] text-text-dim" aria-live="polite">
                  <span className="flex gap-1 rounded-full border border-[rgb(var(--rule))] bg-panel/80 px-2.5 py-2" aria-hidden="true">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                        animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                      />
                    ))}
                  </span>
                  typing…
                </div>
              ) : <p className="text-xs text-text-dim italic">typing...</p>)}
            </div>

            {/* Error banner — shown when peer has no key, send fails, etc. */}
            {chatError && (
              <div className={t("mx-3 mb-2 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[12px] leading-5 text-danger", "border-t border-danger/25 bg-danger/10 px-4 py-2 text-[11px] text-danger")}>
                <div className="flex items-start justify-between gap-2">
                  <span>{chatError}</span>
                  <button onClick={() => setChatError(null)} className={t("-m-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-danger/70 hover:text-danger", "shrink-0 text-danger/70 hover:text-danger")} aria-label="Dismiss">
                    {lamp ? <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> : "×"}
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className={t("sai-bottom border-t border-[rgb(var(--rule))] px-3 pb-2.5 pt-3", "sai-bottom border-t border-line/10 px-3 py-2")}>
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={lamp ? "Write a message" : "Type a message..."}
                  className={t(cn(fieldCls, "flex-1"), "flex-1 rounded-xl border border-line/15 bg-black/15 px-3 py-2 text-sm text-white outline-none focus:border-primary/30")}
                />
                <Button size={lamp ? "md" : "sm"} onClick={handleSend} loading={sending} disabled={!input.trim()} aria-label={lamp ? "Send" : undefined} leading={lamp ? <SendHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : undefined}>
                  {lamp ? <span className="hidden sm:inline">Send</span> : "Send"}
                </Button>
              </div>
              {lamp ? (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-text-dim">
                  <Lock className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  End-to-end encrypted
                </p>
              ) : (
                <p className="mt-1 text-center text-[8px] text-text-dim">🔒 End-to-end encrypted</p>
              )}
            </div>
          </>
        )}

        {/* ── Search View — Find people + Add Friend / Message ── */}
        {view === VIEW.SEARCH && (
          <div className={t("flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4", "flex-1 overflow-y-auto px-4 py-3")}>
            <div className="relative">
              {lamp ? <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" strokeWidth={1.75} aria-hidden="true" /> : null}
              <input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name or email..."
                autoFocus
                className={t(cn(fieldCls, "pl-10"), fieldCls)}
              />
            </div>
            <div className="mt-3 space-y-2">
              {searchResults.map((u, i) => (
                <motion.div
                  key={u.user_id}
                  {...listStagger(i)}
                  className={rowCard}
                >
                  <div
                    className={t("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base", "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base")}
                    style={{ background: u.avatar_color || "var(--color-avatar-fallback)" }}
                  >
                    {u.avatar_emoji || u.name?.charAt(0) || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={t("truncate text-sm font-medium text-text-primary", "truncate text-sm font-medium text-white")}>
                      <UserHoverCard userId={u.user_id}>{u.name}</UserHoverCard>
                    </p>
                    {lamp ? (
                      <p className="truncate text-[12px] text-text-dim">
                        {u.title || "Student"}, <span className="lamp-numerals text-text-muted">{u.xp || 0}</span> XP
                      </p>
                    ) : (
                      <p className="text-[10px] text-text-dim">{u.title || "Student"} · {u.xp || 0} XP</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await chat.sendRequest(u.user_id);
                          alert("Friend request sent!");
                        } catch (err) {
                          const msg = err.response?.data?.error || "Failed";
                          if (msg.includes("already exists")) alert("Request already sent!");
                          else alert(msg);
                        }
                      }}
                    >
                      Add
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => startChat(u.user_id)}
                    >
                      Chat
                    </Button>
                  </div>
                </motion.div>
              ))}
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <p className={t("py-10 text-center text-sm text-text-muted", "py-8 text-center text-sm text-text-dim")}>No users found</p>
              )}
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setView(VIEW.LIST); setSearchQuery(""); setSearchResults([]); }} leading={lamp ? <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> : undefined}>
              Back
            </Button>
          </div>
        )}

        {/* ── Friend Requests View ── */}
        {view === VIEW.REQUESTS && (
          <div className={t("flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4", "flex-1 overflow-y-auto px-4 py-3")}>
            <h4 className={t("text-[13px] font-medium text-text-muted", "font-mono text-[10px] uppercase tracking-wider text-text-dim")}>Pending Requests</h4>
            {pendingRequests.length === 0 ? (
              <p className={t("py-10 text-center text-sm text-text-muted", "py-8 text-center text-sm text-text-dim")}>No pending requests</p>
            ) : (
              <div className="mt-3 space-y-2">
                {pendingRequests.map((req, i) => (
                  <motion.div key={req.id} {...listStagger(i)} className={t(cn(rowCard, "flex-wrap"), "flex items-center gap-3 rounded-lg border border-line/10 bg-black/10 px-3 py-2")}>
                    <div className="min-w-0 flex-1">
                      <p className={t("truncate text-sm font-medium text-text-primary", "text-sm text-white")}>
                        {req.requester?.user_id
                          ? <UserHoverCard userId={req.requester.user_id}>{req.requester?.name || "User"}</UserHoverCard>
                          : (req.requester?.name || "User")}
                      </p>
                      <p className={t("truncate text-[12px] text-text-dim", "text-[10px] text-text-dim")}>{req.requester?.email}</p>
                    </div>
                    <Button size="sm" onClick={async () => {
                      await chat.respondRequest(req.id, true);
                      loadRequests();
                    }}>Accept</Button>
                    <Button variant="ghost" size="sm" onClick={async () => {
                      await chat.respondRequest(req.id, false);
                      loadRequests();
                    }}>Decline</Button>
                  </motion.div>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setView(VIEW.LIST)} leading={lamp ? <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> : undefined}>Back</Button>
          </div>
        )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
