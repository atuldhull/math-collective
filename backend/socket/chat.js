/**
 * Real-time chat relays. The actual message payload is end-to-end encrypted
 * by the client (ECDH + AES-GCM) — the server just forwards bytes between
 * the right user-rooms. `socket.userId` is the authoritative senderId; we
 * never trust one supplied in the message body.
 *
 * Anonymous sockets are allowed to connect (public pages use real-time for
 * events and notification previews), and these three handlers used to fan
 * out to any `user:<id>` room regardless of who was asking. The contents
 * could not be forged — they are encrypted — but the CHANNEL was open:
 * anyone could push "chat:receive" and "chat:typing" events at any member
 * they could name. Every handler now requires an identified sender, and a
 * recipient that is somebody other than themselves.
 */

import { logger } from "../config/logger.js";

/** A relay target must be a plausible id and not the sender themselves. */
function relayTarget(socket, recipientId) {
  if (!socket.userId) return null;
  if (typeof recipientId !== "string") return null;
  const id = recipientId.trim();
  if (!id || id.length > 64) return null;
  if (id === socket.userId) return null;   // no self-relay loops
  return id;
}

export function attachChat(io, socket) {
  socket.on("chat:send", ({ conversationId, recipientId, encryptedContent, iv, messageType }) => {
    const target = relayTarget(socket, recipientId);
    if (!target) {
      logger.warn({ socketId: socket.id, userId: socket.userId }, "chat:send refused");
      return;
    }

    io.to(`user:${target}`).emit("chat:receive", {
      conversationId,
      senderId:         socket.userId,
      encryptedContent,
      iv,
      messageType:      messageType || "text",
      createdAt:        new Date().toISOString(),
    });
  });

  socket.on("chat:typing", ({ conversationId, recipientId }) => {
    const target = relayTarget(socket, recipientId);
    if (!target) return;

    io.to(`user:${target}`).emit("chat:typing", {
      conversationId,
      userId: socket.userId,
    });
  });

  socket.on("chat:read", ({ conversationId, senderId }) => {
    const target = relayTarget(socket, senderId);
    if (!target) return;

    io.to(`user:${target}`).emit("chat:read", {
      conversationId,
      readBy: socket.userId,
      readAt: new Date().toISOString(),
    });
  });
}
