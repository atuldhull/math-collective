/**
 * ChatButton — Floating button to open the chat panel.
 * Only visible when user is logged in.
 */

import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { useUiStore } from "@/store/ui-store";
import ChatPanel from "@/components/chat/ChatPanel";
import { MessageCircle } from "lucide-react";
import { useIsLamplight } from "@/components/lamp/SkinProvider";

export default function ChatButton() {
  // Phase 15: panel state lives in ui-store so MessageButton (on
  // profiles + hovercards) can open it pre-targeted without
  // prop-drilling. The floating button just toggles; targeted-open
  // goes through useUiStore.openChatWith(userId).
  const open = useUiStore((s) => s.chatPanel.open);
  const targetUserId = useUiStore((s) => s.chatPanel.targetUserId);
  const toggleChat = useUiStore((s) => s.toggleChat);
  const closeChat = useUiStore((s) => s.closeChat);
  const clearChatTarget = useUiStore((s) => s.clearChatTarget);

  const lamp = useIsLamplight();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);

  // Only show for authenticated users
  if (status !== "authenticated" || !user) return null;

  return (
    <>
      {/* Floating button — positioned above PANDA bot */}
      {lamp ? (
        <motion.button
          onClick={toggleChat}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 420, damping: 24 }}
          className="lamp-float group fixed bottom-5 left-5 z-50 grid h-12 w-12 place-items-center rounded-2xl border border-[rgb(var(--lamp)/0.35)] bg-[rgb(var(--color-surface)/0.85)] text-primary shadow-[0_14px_40px_-14px_rgb(var(--lamp)/0.6)] backdrop-blur-xl transition-[border-color,box-shadow] duration-300 hover:border-[rgb(var(--lamp)/0.6)] hover:shadow-[0_18px_48px_-12px_rgb(var(--lamp)/0.8)]"
          aria-label="Open messages"
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgb(var(--lamp)/0.22),transparent_65%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <MessageCircle className="relative h-5 w-5 transition-transform duration-300 group-hover:-rotate-6" strokeWidth={1.75} aria-hidden="true" />
        </motion.button>
      ) : (
      <motion.button
        onClick={toggleChat}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="lamp-float fixed bottom-5 left-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-surface/80 shadow-lg backdrop-blur-xl transition hover:border-primary/50"
        style={{ boxShadow: "0 4px 20px rgb(var(--color-primary)/0.2)" }}
        aria-label="Open messages"
      >
        <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </motion.button>
      )}

      {/* Chat panel — targetUserId triggers auto-navigation to that
          user's 1-to-1 conversation when the panel opens. */}
      <ChatPanel
        open={open}
        onClose={closeChat}
        initialPeerUserId={targetUserId}
        onTargetConsumed={clearChatTarget}
      />
    </>
  );
}
