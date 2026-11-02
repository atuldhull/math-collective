import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { AlertCircle, ArrowUpRight, CheckCheck, Trash2, UserPlus } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { PageHeader, EmptyState } from "@/components/lamp";
import { notifications, chat } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const ICON = { strokeWidth: 1.75 };

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/** Bucket notifications into day groups ("Today", "Yesterday", "Monday 26 Oct"), keeping list order. */
function groupByDay(list) {
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOf(new Date());
  const DAY = 86400000;
  const groups = new Map();
  for (const n of list) {
    const raw = n.created_at || n.createdAt;
    const d = raw ? new Date(raw) : null;
    let key = "undated";
    let label = "Earlier";
    if (d && !Number.isNaN(d.getTime())) {
      const day = startOf(d);
      key = String(day);
      if (day === today) label = "Today";
      else if (day === today - DAY) label = "Yesterday";
      else {
        label = d.toLocaleDateString("en-IN", {
          weekday: "long", day: "numeric", month: "short",
          ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
        });
      }
    }
    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key).items.push(n);
  }
  return [...groups.values()];
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const socketRef = useRef(null);
  const user = useAuthStore((s) => s.user);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await notifications.list();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Socket.IO real-time connection
  useEffect(() => {
    const socket = io(window.location.origin, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (user?.id || user?._id) {
        socket.emit("register_user", user.id || user._id);
      }
    });

    socket.on("notification", (notif) => {
      if (notif && (notif.id || notif._id)) {
        setItems((prev) => {
          const exists = prev.some(
            (n) => (n.id || n._id) === (notif.id || notif._id)
          );
          if (exists) return prev;
          return [notif, ...prev];
        });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const handleMarkRead = useCallback(async (id) => {
    try {
      setMarkingId(id);
      await notifications.markRead(id);
      setItems((prev) =>
        prev.map((n) =>
          (n.id === id || n._id === id) ? { ...n, is_read: true, read: true } : n
        )
      );
    } catch {
      // Silently fail - the user can retry
    } finally {
      setMarkingId(null);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      setMarkingAll(true);
      await notifications.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true, read: true })));
    } catch {
      // Silently fail
    } finally {
      setMarkingAll(false);
    }
  }, []);

  const handleClearAll = useCallback(async () => {
    try {
      setClearing(true);
      await notifications.clear();
      setItems([]);
    } catch {
      // Silently fail
    } finally {
      setClearing(false);
    }
  }, []);

  // Fetch pending friend requests
  useEffect(() => {
    chat.getPending().then(r => setPendingRequests(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const handleAcceptFriend = async (requestId, userId) => {
    try {
      await chat.respondRequest(requestId, true);
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      // Mark the related notification as read
      const relatedNotif = items.find(n => n.title === "New Friend Request" && !n.is_read);
      if (relatedNotif) {
        await notifications.markRead(relatedNotif.id || relatedNotif._id);
        setItems(prev => prev.map(n => (n.id || n._id) === (relatedNotif.id || relatedNotif._id) ? { ...n, is_read: true } : n));
      }
      // Redirect to friend's profile
      if (userId) navigate(`/student/${userId}`);
    } catch { /* ignore */ }
  };

  const handleRejectFriend = async (requestId) => {
    try {
      await chat.respondRequest(requestId, false);
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch { /* ignore */ }
  };

  const unreadCount = items.filter((n) => !n.is_read && !n.read).length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader variant="orbit" size="lg" label="Loading notifications..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="lamp-panel flex max-w-md flex-col items-center gap-4 px-6 py-10 text-center">
          <AlertCircle className="h-10 w-10 text-danger/70" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-sm text-danger">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchNotifications}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const groups = groupByDay(items);
  let rowIndex = -1;

  return (
    <div className="pb-16">
      <PageHeader
        context={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        title="Notifications"
        description={unreadCount > 0
          ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
          : "All caught up! New notifications appear here in real time."}
        progress={items.length ? (items.length - unreadCount) / items.length : 1}
        actions={(
          <>
            <Button
              variant="secondary"
              size="sm"
              loading={markingAll}
              disabled={unreadCount === 0}
              onClick={handleMarkAllRead}
              leading={<CheckCheck className="h-4 w-4" {...ICON} />}
            >
              Mark All Read
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={clearing}
              disabled={items.length === 0}
              onClick={handleClearAll}
              leading={<Trash2 className="h-4 w-4" {...ICON} />}
            >
              Clear All
            </Button>
          </>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
        {/* Notification list, grouped by day */}
        <div className="min-w-0 lg:order-1">
          {items.length === 0 ? (
            <EmptyState
              title="No Notifications"
              body="You're all caught up. New notifications will appear here in real time."
            />
          ) : (
            <div className="space-y-8">
              <AnimatePresence initial={false}>
                {groups.map((group) => (
                  <motion.section
                    key={group.key}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.2, delay: 0.25 } }}
                    aria-label={group.label}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <h2 className="text-[15px] font-medium text-text-primary">{group.label}</h2>
                      <span className="h-px flex-1 bg-[rgb(var(--rule))]" />
                      <span className="text-[12px] tabular-nums text-text-dim">{group.items.length}</span>
                    </div>

                    <ul className="lamp-panel divide-y divide-[rgb(var(--rule))] overflow-hidden">
                      <AnimatePresence initial={false} mode="popLayout">
                        {group.items.map((notif) => {
                          rowIndex += 1;
                          const order = rowIndex;
                          const id = notif.id || notif._id;
                          const isUnread = !notif.is_read && !notif.read;
                          const isMarking = markingId === id;
                          const bodyText = notif.body || notif.message || "";

                          const handleClick = async () => {
                            if (isUnread) await handleMarkRead(id);
                            // Navigate to link if present
                            if (notif.link) navigate(notif.link);
                          };

                          return (
                            <motion.li
                              key={id}
                              layout
                              initial={{ opacity: 0, x: -16 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 40, transition: { duration: 0.28, delay: Math.min(order, 12) * 0.03 } }}
                              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                              className={`group relative flex cursor-pointer items-start gap-4 px-4 py-4 transition-colors sm:px-5 ${
                                isUnread ? "bg-primary/[0.045] hover:bg-primary/[0.08]" : "hover:bg-white/[0.025]"
                              }`}
                              onClick={handleClick}
                            >
                              {/* Lamp dot — lit while unread, goes out when read. */}
                              <span className="relative mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center">
                                <span className="absolute inset-0 rounded-full bg-white/10" />
                                <AnimatePresence initial={false}>
                                  {isUnread && (
                                    <motion.span
                                      key="lit"
                                      className="absolute inset-0 rounded-full bg-primary shadow-[0_0_12px_rgb(var(--lamp)/0.9)]"
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      exit={{ scale: 0, opacity: 0, transition: { duration: 0.45, delay: Math.min(order, 12) * 0.04, ease: "backIn" } }}
                                    />
                                  )}
                                </AnimatePresence>
                                {isUnread && (
                                  <motion.span
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-full bg-primary"
                                    animate={{ scale: [1, 2.2], opacity: [0.45, 0] }}
                                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeOut" }}
                                  />
                                )}
                                <span className="sr-only">{isUnread ? "Unread" : "Read"}</span>
                              </span>

                              {/* Content */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <h3 className={`text-sm font-medium transition-colors ${isUnread ? "text-text-primary" : "text-text-muted"}`}>
                                      {notif.title}
                                    </h3>
                                    {bodyText && (
                                      <p className={`mt-1 text-sm leading-6 ${isUnread ? "text-text-muted" : "text-text-dim"}`}>
                                        {bodyText}
                                      </p>
                                    )}
                                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-dim">
                                      <span>{formatTime(notif.created_at || notif.createdAt)}</span>
                                      {notif.link && (
                                        <span className="inline-flex items-center gap-1 text-primary">
                                          Open <ArrowUpRight className="h-3 w-3" {...ICON} aria-hidden="true" />
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  {isUnread && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      loading={isMarking}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkRead(id);
                                      }}
                                      className="flex-shrink-0 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                                    >
                                      Mark Read
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </motion.li>
                          );
                        })}
                      </AnimatePresence>
                    </ul>
                  </motion.section>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Side column: counts + friend requests */}
        <aside className="order-first min-w-0 space-y-6 lg:order-2">
          <section data-reveal="right" className="lamp-panel grid grid-cols-3 divide-x divide-[rgb(var(--rule))] py-4">
            {[
              { label: "Total", value: items.length, tone: "text-text-primary" },
              { label: "Unread", value: unreadCount, tone: "text-primary" },
              { label: "Read", value: items.length - unreadCount, tone: "text-text-muted" },
            ].map((stat) => (
              <div key={stat.label} className="px-4">
                <p className="text-[13px] text-text-muted">{stat.label}</p>
                <p className={`lamp-numerals mt-1 text-3xl leading-none ${stat.tone}`}>
                  <AnimatedNumber value={stat.value} duration={0.8} />
                </p>
              </div>
            ))}
          </section>

          {/* Pending Friend Requests */}
          {pendingRequests.length > 0 && (
            <section data-reveal="right" className="lamp-panel lamp-panel--lit p-5">
              <h3 className="flex items-center gap-2 text-lg text-text-primary">
                <UserPlus className="h-4 w-4 text-primary" {...ICON} aria-hidden="true" />
                Friend requests
              </h3>
              <p className="mt-1 text-[13px] text-text-muted">{pendingRequests.length} Pending</p>
              <ul className="mt-4 space-y-3">
                <AnimatePresence initial={false}>
                  {pendingRequests.map((req) => (
                    <motion.li
                      key={req.id}
                      layout
                      exit={{ opacity: 0, x: 40, transition: { duration: 0.25 } }}
                      className="rounded-xl bg-white/[0.03] p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg">
                          {req.avatar_emoji || "👤"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">{req.name || "Unknown"}</p>
                          <p className="truncate text-[12px] text-text-dim">{req.email || ""}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" className="flex-1 justify-center" onClick={() => handleAcceptFriend(req.id, req.user_id || req.requester_id)}>
                          Accept
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1 justify-center" onClick={() => handleRejectFriend(req.id)}>
                          Decline
                        </Button>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
