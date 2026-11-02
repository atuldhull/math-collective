/**
 * SavedPage — /saved
 *
 * Single feed of everything the viewer has bookmarked across the
 * three target types (problems, writeups, roadmaps). Each row links
 * to the underlying entity and shows enough metadata that the
 * student remembers WHY they saved it. Filter tabs let them slice
 * by type when the feed grows long.
 *
 * The "unsave" button on each row pops the item out optimistically.
 */

import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowBigUp, Bookmark, FileText, Map as MapIcon, Star, Target } from "lucide-react";
import { bookmarks as bookmarksApi } from "@/lib/api";
import Loader from "@/components/ui/Loader";
import { PageHeader, SegmentedTabs, EmptyState } from "@/components/lamp";
import { SourceBadge, DifficultyMeter } from "@/features/problems/components/ProblemMeta";

const TYPE_TABS = [
  { key: "",        label: "All" },
  { key: "problem", label: "Problems" },
  { key: "writeup", label: "Writeups" },
  { key: "roadmap", label: "Roadmaps" },
];

export default function SavedPage() {
  const [params, setParams] = useSearchParams();
  const filterType = params.get("type") || "";

  const [data,    setData]    = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    bookmarksApi.list(filterType ? { type: filterType } : {}, { signal: ctrl.signal })
      .then(({ data }) => {
        setData({ rows: data.data || [], total: data.total || 0 });
        setLoading(false);
      })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        setError(err?.response?.data?.error || "Couldn't load your saved items");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [filterType]);

  const onUnsave = useCallback(async (row) => {
    // Optimistic — strip it immediately, only roll back on failure.
    setData((d) => ({
      rows:  d.rows.filter((r) => !(r.target_type === row.target_type && r.target_id === row.target_id)),
      total: Math.max(0, d.total - 1),
    }));
    try {
      await bookmarksApi.toggle(row.target_type, row.target_id);
    } catch {
      // Rollback: re-insert at top. Order won't match server but the
      // feed has not been re-fetched so it's a close-enough recovery.
      setData((d) => ({ rows: [row, ...d.rows], total: d.total + 1 }));
    }
  }, []);

  const onTab = (key) => {
    const next = new URLSearchParams(params);
    if (key) next.set("type", key); else next.delete("type");
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-4xl pb-20">
      <PageHeader
        context="Personal"
        title="Saved"
        description="Everything you've starred — problems to come back to, writeups worth re-reading, roadmaps you're tracking."
      >
        {/* Type tabs */}
        <SegmentedTabs
          aria-label="Filter saved items"
          items={TYPE_TABS.map((t) => ({
            value: t.key,
            label: t.label,
            ...(t.key === filterType && !loading ? { count: data.total } : {}),
          }))}
          value={filterType}
          onChange={onTab}
        />
      </PageHeader>

      {loading && (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader variant="orbit" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && !error && data.rows.length === 0 && (
        <EmptyState
          title="No saved items yet."
          body="Tap the star on any problem, writeup, or roadmap to save it here."
          action={
            <Link
              to="/problems"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-[rgb(var(--color-obsidian))] transition hover:brightness-110"
            >
              Browse problems
            </Link>
          }
        />
      )}

      {!loading && (
        <ul className="space-y-3">
          <AnimatePresence initial={true}>
            {data.rows.map((row, i) => (
              <SavedRow key={`${row.target_type}:${row.target_id}`} row={row} index={i} onUnsave={() => onUnsave(row)} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

const TYPE_ICON = { problem: Target, writeup: FileText, roadmap: MapIcon };

function SavedRow({ row, index, onUnsave }) {
  const Icon = TYPE_ICON[row.target_type] || Bookmark;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 18, rotateX: -12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      exit={{ opacity: 0, x: 80, scale: 0.94, transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 900 }}
      className="lamp-panel group/row p-4 transition-colors hover:border-primary/30 sm:p-5"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-text-muted transition-colors group-hover/row:text-primary" aria-hidden="true">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <RowContent row={row} />
        <motion.button
          type="button"
          onClick={onUnsave}
          whileTap={{ scale: 0.85, rotate: -20 }}
          aria-label="Unsave"
          className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium text-primary transition hover:bg-warning/10 hover:text-warning"
        >
          <Star className="h-4 w-4" strokeWidth={1.75} fill="currentColor" />
          <span className="hidden sm:inline">Unsave</span>
        </motion.button>
      </div>
    </motion.li>
  );
}

function RowContent({ row }) {
  if (!row.target) {
    return (
      <p className="min-w-0 flex-1 self-center text-sm italic text-text-dim">
        This {row.target_type} is no longer available.
      </p>
    );
  }

  if (row.target_type === "problem") {
    const p = row.target;
    return (
      <Link to={`/problems/${p.slug || p.id}`} className="group block min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <SourceBadge source={p.source} />
          <DifficultyMeter level={p.difficulty} />
        </div>
        <p className="mt-2 text-[15px] font-semibold leading-snug text-text-primary transition group-hover:text-primary">{p.title}</p>
        <p className="mt-1 text-xs text-text-dim">
          Saved {new Date(row.created_at).toLocaleDateString()}
        </p>
      </Link>
    );
  }

  if (row.target_type === "writeup") {
    const w = row.target;
    const parent = w.parent_problem;
    return (
      <Link to={parent ? `/problems/${parent.slug || parent.id}` : "#"} className="group block min-w-0 flex-1">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted">
          Writeup
          <span className="inline-flex items-center gap-0.5 tabular-nums text-text-dim">
            <ArrowBigUp className="h-3.5 w-3.5" strokeWidth={1.75} />{w.vote_count}
          </span>
        </span>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug text-text-primary transition group-hover:text-primary">{w.title}</p>
        {parent && (
          <p className="mt-1 truncate text-xs text-text-dim">
            on <span className="text-text-muted">{parent.title}</span>
          </p>
        )}
      </Link>
    );
  }

  if (row.target_type === "roadmap") {
    const r = row.target;
    return (
      <Link to={`/roadmaps/${encodeURIComponent(r.slug)}`} className="group block min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[13px] font-medium text-text-muted">
          {r.cover_emoji ? <span aria-hidden="true" className="text-base leading-none">{r.cover_emoji}</span> : null}
          <span>Roadmap in {r.topic}</span>
        </div>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug text-text-primary transition group-hover:text-primary">{r.title}</p>
        <p className="mt-1 line-clamp-2 text-sm text-text-muted">{r.summary}</p>
      </Link>
    );
  }

  return null;
}
