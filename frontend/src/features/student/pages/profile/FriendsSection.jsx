import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, UserPlus, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { SegmentedTabs } from "@/components/lamp";
import { chat } from "@/lib/api";

export default function FriendsSection() {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState("friends");
  const [loadingFriends, setLoadingFriends] = useState(true);

  useEffect(() => {
    Promise.all([
      chat.getFriends().catch(() => ({ data: [] })),
      chat.getPending().catch(() => ({ data: [] })),
    ]).then(([f, p]) => {
      setFriends(f.data || []);
      setPending(p.data || []);
      setLoadingFriends(false);
    });
  }, []);

  const handleSearch = async (q) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    try {
      const { data } = await chat.searchUsers(q);
      setResults(data || []);
    } catch { setResults([]); }
  };

  return (
    <section data-reveal="right" className="lamp-panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg text-text-primary">Friends and messages</h3>
        {pending.length > 0 && (
          <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-secondary px-1.5 text-[12px] font-semibold text-text-primary">
            {pending.length}
          </span>
        )}
      </div>

      <SegmentedTabs
        size="sm"
        aria-label="Friends view"
        className="mt-4 flex w-full [&>button]:flex-1"
        value={tab}
        onChange={setTab}
        items={[
          { value: "friends", label: "Friends", count: friends.length },
          { value: "requests", label: "Requests", count: pending.length || undefined },
          { value: "find", label: "Find people" },
        ]}
      />

      <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
        {/* Friends tab */}
        {tab === "friends" && (
          loadingFriends ? (
            <p className="py-5 text-center text-[13px] text-text-dim">Loading...</p>
          ) : friends.length === 0 ? (
            <div className="py-6 text-center">
              <UserPlus className="mx-auto h-5 w-5 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
              <p className="mt-2 text-[13px] text-text-dim">No friends yet</p>
              <button onClick={() => setTab("find")} className="mt-1 h-10 text-[13px] font-medium text-primary hover:underline">
                Find people to connect with
              </button>
            </div>
          ) : (
            friends.map((f) => (
              <Link
                key={f.user_id}
                to={`/student/${f.user_id}`}
                className="flex min-h-[52px] items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.04]"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                  style={{ background: f.avatar_color || "linear-gradient(135deg, rgb(var(--violet)), rgb(var(--lamp)/0.8))" }}
                >
                  {f.avatar_emoji || f.name?.charAt(0) || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary">{f.name}</p>
                  <p className="flex gap-3 text-[12px] text-text-dim"><span>{f.title || "Student"}</span><span className="tabular-nums">{(f.xp || 0).toLocaleString()} XP</span></p>
                </div>
                <MessageCircle className="h-4 w-4 shrink-0 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            ))
          )
        )}

        {/* Requests tab */}
        {tab === "requests" && (
          pending.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-text-dim">No pending requests</p>
          ) : (
            <AnimatePresence initial={false}>
            {pending.map((req) => (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.25 } }}
                className="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary">{req.requester?.name || "User"}</p>
                  <p className="truncate text-[12px] text-text-dim">{req.requester?.email || ""}</p>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    await chat.respondRequest(req.id, true);
                    setPending((p) => p.filter((r) => r.id !== req.id));
                    chat.getFriends().then((r) => setFriends(r.data || []));
                  }}
                >
                  Accept
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Decline request"
                  onClick={async () => {
                    await chat.respondRequest(req.id, false);
                    setPending((p) => p.filter((r) => r.id !== req.id));
                  }}
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </motion.div>
            ))}
            </AnimatePresence>
          )
        )}

        {/* Find People tab */}
        {tab === "find" && (
          <>
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="mb-1 h-11 w-full rounded-xl border border-[rgb(var(--rule))] bg-obsidian/40 px-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/40"
            />
            {results.length === 0 && search.length >= 2 && (
              <p className="py-4 text-center text-[13px] text-text-dim">No one matches that name or email.</p>
            )}
            {results.map((u) => (
              <div key={u.user_id} className="flex min-h-[52px] items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.04]">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
                  style={{ background: u.avatar_color || "linear-gradient(135deg, rgb(var(--violet)), rgb(var(--lamp)/0.8))" }}
                >
                  {u.avatar_emoji || u.name?.charAt(0) || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-text-primary">{u.name}</p>
                  <p className="text-[12px] tabular-nums text-text-dim">{(u.xp || 0).toLocaleString()} XP</p>
                </div>
                <Link
                  to={`/student/${u.user_id}`}
                  className="flex h-10 shrink-0 items-center rounded-xl bg-primary/10 px-3 text-[13px] font-medium text-primary transition hover:bg-primary/20"
                >
                  View Profile
                </Link>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
