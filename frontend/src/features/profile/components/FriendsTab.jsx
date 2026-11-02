/**
 * FriendsTab — paginated list of the target user's friends.
 *
 * Data: GET /api/users/:id/friends (Phase 3 endpoint). Each row
 * carries `isMutual: true` when the viewer is also friends with
 * that person — we badge those rows to help the viewer recognise
 * shared connections.
 *
 * Pagination: offset/limit; "Load more" button appends to the list.
 * Client-side name search filters WITHIN loaded pages only (good
 * enough for club-scale friend lists; a server-side search can be
 * added later if needed).
 *
 * Privacy: the backend returns `hiddenByUser: true` when the target
 * has show_friend_list=false. We render a "This user has hidden
 * their friends list" card in that case rather than silently empty.
 *
 * Self-actions: when viewing OWN profile (access.isSelf), each row
 * gets a small "Remove" button that fires the unfriend action.
 * Deliberately scoped to self-view — you can't unfriend someone
 * from their own profile page anyway (nobody would expect that UX).
 */

import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { users, chat } from "@/lib/api";
import { Search } from "lucide-react";
import { EmptyState } from "@/components/lamp";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import { useRelationshipStore } from "@/store/relationship-store";

const PAGE_SIZE = 20;

/**
 * @param {{
 *   userId: string,
 *   access: { isSelf: boolean },
 * }} props
 */
export default function FriendsTab({ userId, access }) {
  const [friends, setFriends]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [hidden, setHidden]     = useState(false);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [removing, setRemoving] = useState(null);
  const invalidate = useRelationshipStore((s) => s.invalidate);

  const fetchPage = useCallback(async (p) => {
    try {
      const { data } = await users.friends(userId, p, PAGE_SIZE);
      setHidden(!!data.hiddenByUser);
      setTotal(data.total || 0);
      setFriends((prev) => p === 1 ? (data.friends || []) : [...prev, ...(data.friends || [])]);
    } catch {
      // Silent — keep whatever we had. A retry button could be
      // added but the parent's error boundary already catches
      // catastrophic failures.
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setPage(1);
    fetchPage(1).finally(() => setLoading(false));
  }, [userId, fetchPage]);

  const loadMore = async () => {
    setLoadingMore(true);
    const next = page + 1;
    await fetchPage(next);
    setPage(next);
    setLoadingMore(false);
  };

  // Self-view only: unfriend from the profile row directly.
  const handleRemove = async (friend) => {
    if (!access.isSelf) return;
    if (!window.confirm(`Unfriend ${friend.name || "this user"}?`)) return;
    setRemoving(friend.id);
    try {
      // Need the friendshipId. We don't have it inline on this endpoint,
      // so ask the relationship store (which wraps the backend lookup
      // + cache). A just-in-time fetch is fine — nobody unfriends 100
      // people at once.
      let rel = useRelationshipStore.getState().byUserId[friend.id];
      if (!rel?.friendshipId) {
        rel = await useRelationshipStore.getState().fetch(friend.id);
      }
      if (rel?.friendshipId) {
        await chat.unfriend(rel.friendshipId);
        invalidate(friend.id, (prev) => ({
          self: prev?.self ?? false,
          friendship: null,
          blocked: prev?.blocked ?? false,
          canMessage: prev?.canMessage ?? false,
          friendshipId: null,
        }));
        setFriends((prev) => prev.filter((f) => f.id !== friend.id));
        setTotal((t) => Math.max(0, t - 1));
      }
    } catch {
      // Ignore; UI stays as-is on failure.
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center">
        <Loader variant="dots" size="sm" />
      </div>
    );
  }

  if (hidden) {
    return (
      <EmptyState compact title="This user has hidden their friends list" />
    );
  }

  if (total === 0) {
    return (
      <EmptyState compact title="No friends yet" body="Connections made in the arena and at events show up here." />
    );
  }

  // Client-side name filter against the currently-loaded pages.
  const q = search.trim().toLowerCase();
  const visible = q
    ? friends.filter((f) => (f.name || "").toLowerCase().includes(q))
    : friends;

  const hasMore = friends.length < total;

  return (
    <div className="space-y-3">
      {/* Search + count header */}
      <div className="flex items-center justify-between gap-3">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search friends..."
            className="h-11 w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 pl-10 pr-4 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/40"
          />
        </label>
        <span className="shrink-0 text-[13px] tabular-nums text-text-muted">
          {total} {total === 1 ? "friend" : "friends"}
        </span>
      </div>

      {/* Rows */}
      <div data-stagger="up" className="lamp-panel divide-y divide-[rgb(var(--rule))] overflow-hidden">
        {visible.map((f) => (
          <div
            key={f.id}
            className="flex min-h-[60px] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03] sm:px-4"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ backgroundColor: f.avatar_color || "rgba(255,255,255,0.06)" }}
              aria-hidden
            >
              {f.avatar_emoji || "👤"}
            </div>
            <Link to={`/profile/${f.id}`} className="group min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary transition-colors group-hover:text-primary">{f.name}</p>
              <p className="flex flex-wrap items-center gap-2 text-[12px] text-text-dim">
                <span className="capitalize">{f.title || "member"}</span>
                {f.isMutual && <span className="rounded-full border border-secondary/30 bg-secondary/12 px-2 py-0.5 text-[11px] text-secondary">Mutual</span>}
              </p>
            </Link>
            {typeof f.xp === "number" && (
              <span className="shrink-0 text-[13px] tabular-nums text-primary">{f.xp} XP</span>
            )}
            {access.isSelf && (
              <Button
                size="sm"
                variant="ghost"
                loading={removing === f.id}
                onClick={() => handleRemove(f)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        {visible.length === 0 && (
          <p className="p-5 text-center text-[13px] text-text-dim">No friends match that name.</p>
        )}
      </div>

      {/* Load more */}
      {hasMore && !q && (
        <div className="flex justify-center pt-2">
          <Button size="sm" variant="secondary" loading={loadingMore} onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
