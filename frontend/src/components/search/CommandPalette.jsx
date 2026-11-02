/**
 * CommandPalette — Ctrl/Cmd+K global search modal.
 *
 * Three result groups, all keyboard-driven:
 *   • Pages       — static SPA destinations (Dashboard, Saved, etc.).
 *                   Synthesised client-side; matched by prefix on the
 *                   label so /api/search isn't bothered with them.
 *   • Problems    — title / description ilike on problem_statements
 *   • Roadmaps    — title / summary       ilike on approved roadmaps
 *   • Writeups    — title / body          ilike on published writeups
 *   • Portfolios  — name / handle         ilike on public portfolios
 *
 * The remote groups come from a single /api/search round-trip,
 * debounced 220ms. Each fresh keystroke aborts the inflight request,
 * so the network never holds a stale typed-then-deleted phrase.
 *
 * Keyboard:
 *   ↑/↓     — move highlight (wraps within the flattened result list)
 *   ⏎       — navigate to the highlighted result
 *   Esc     — close
 *   Ctrl/⌘+K — toggle from anywhere (handled by parent, not here)
 *
 * Focus management:
 *   The input takes focus on open and stays focused; arrow keys
 *   mutate the highlighted index, not the cursor. We avoid focusing
 *   individual result rows so the user never has to tab between
 *   typing and selecting — that's the whole point of a palette.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, BookOpen, CornerDownLeft, Puzzle, Route, Search, Sparkles, UserRound } from "lucide-react";
import { search as searchApi } from "@/lib/api";
import { useIsLamplight } from "@/components/lamp/SkinProvider";
import { cn } from "@/lib/cn";

const DEBOUNCE_MS = 220;
const MIN_CHARS   = 2;

// Static destinations always present in the palette. Keep the list
// short — adding every settings subpage would dilute the signal.
const STATIC_PAGES = [
  { key: "dashboard",     label: "Dashboard",     hint: "Your daily problem + progress", to: "/dashboard" },
  { key: "problems",      label: "Problems",      hint: "Catalogue of problem statements", to: "/problems" },
  { key: "roadmaps",      label: "Roadmaps",      hint: "Sequenced learning paths",        to: "/roadmaps" },
  { key: "sprints",       label: "Sprints",       hint: "Weekly featured problem + leaderboard", to: "/sprints" },
  { key: "saved",         label: "Saved",         hint: "Bookmarked problems + writeups",  to: "/saved" },
  { key: "leaderboard",   label: "Leaderboard",   hint: "Weekly + all-time arena rankings", to: "/leaderboard" },
  { key: "notifications", label: "Notifications", hint: "Recent engagement events",        to: "/notifications" },
  { key: "profile",       label: "Profile",       hint: "Your account + settings",         to: "/profile" },
  { key: "submit",        label: "Submit a problem", hint: "Paste a URL — AI drafts it",   to: "/problems/submit" },
];

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const lamp     = useIsLamplight();

  const [q,          setQ]          = useState("");
  const [groups,     setGroups]     = useState({ problem: [], roadmap: [], writeup: [], portfolio: [] });
  const [loading,    setLoading]    = useState(false);
  const [activeIdx,  setActiveIdx]  = useState(0);

  // ── On open: focus the input, reset state. ────────────────────
  useEffect(() => {
    if (!open) return;
    setQ("");
    setGroups({ problem: [], roadmap: [], writeup: [], portfolio: [] });
    setActiveIdx(0);
    // Defer so the motion mount finishes before focus — otherwise the
    // browser sometimes refuses focus on an element that's still
    // animating from scale 0.94.
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  // ── Debounced search. AbortController cancels stale flights. ──
  useEffect(() => {
    if (!open) return;
    const needle = q.trim();
    if (needle.length < MIN_CHARS) {
      setGroups({ problem: [], roadmap: [], writeup: [], portfolio: [] });
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;

    setLoading(true);
    const t = setTimeout(() => {
      searchApi
        .query(needle, null, { signal: ctrl.signal })
        .then(({ data }) => {
          setGroups(data.groups || { problem: [], roadmap: [], writeup: [], portfolio: [] });
          setLoading(false);
          setActiveIdx(0);
        })
        .catch((err) => {
          if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  // ── Flatten groups into a single nav list so ↑/↓ can wrap. ────
  // The flat list also captures the static pages (filtered by needle
  // prefix) so they're navigable by keyboard the same as remote hits.
  const flatItems = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pages = needle
      ? STATIC_PAGES.filter((p) => p.label.toLowerCase().includes(needle))
      : STATIC_PAGES;

    return [
      ...pages.map((p) => ({ kind: "page", id: p.key, label: p.label, hint: p.hint, to: p.to })),
      ...groups.problem.map((p) => ({
        kind: "problem", id: p.id, label: p.title,
        hint: `${p.source || "Problem"} · ${p.difficulty || ""}`.trim(),
        to: `/problems/${p.slug || p.id}`,
      })),
      ...groups.roadmap.map((r) => ({
        kind: "roadmap", id: r.id, label: r.title,
        hint: r.snippet || "Roadmap",
        to: `/roadmaps/${r.slug || r.id}`,
      })),
      ...groups.writeup.map((w) => ({
        kind: "writeup", id: w.id, label: w.title,
        hint: w.problem_title ? `Writeup · ${w.problem_title}` : "Writeup",
        to: w.problem_slug ? `/problems/${w.problem_slug}` : "/problems",
      })),
      ...groups.portfolio.map((s) => ({
        kind: "portfolio", id: s.user_id, label: s.name || s.handle,
        hint: s.headline || `@${s.handle}`,
        to: `/u/${s.handle}`,
      })),
    ];
  }, [q, groups]);

  // ── Keyboard handling on the input. ───────────────────────────
  const onKey = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (flatItems.length ? (i + 1) % flatItems.length : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (flatItems.length ? (i - 1 + flatItems.length) % flatItems.length : 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[activeIdx];
        if (item) {
          navigate(item.to);
          onClose?.();
        }
      }
    },
    [activeIdx, flatItems, navigate, onClose],
  );

  // ── Click-through nav. ────────────────────────────────────────
  const onPick = useCallback(
    (item) => {
      navigate(item.to);
      onClose?.();
    },
    [navigate, onClose],
  );

  if (!open) return null;

  const showHint = q.trim().length < MIN_CHARS;

  if (lamp) {
    return (
      <LampPalette
        inputRef={inputRef}
        q={q}
        setQ={setQ}
        onKey={onKey}
        onClose={onClose}
        onPick={onPick}
        showHint={showHint}
        loading={loading}
        flatItems={flatItems}
        activeIdx={activeIdx}
        setActiveIdx={setActiveIdx}
      />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[60] flex items-start justify-center bg-black/75 p-4 pt-[12vh] backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl overflow-hidden rounded-2xl border border-line/15 bg-surface/95 shadow-panel backdrop-blur-2xl"
        >
          {/* ── Search input ── */}
          <div className="flex items-center gap-3 border-b border-line/10 px-4 py-3">
            <svg className="h-4 w-4 shrink-0 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              placeholder="Search problems, roadmaps, writeups, people…"
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-dim"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden shrink-0 rounded border border-line/20 bg-[rgb(var(--color-text-primary)/0.04)] px-1.5 py-0.5 font-mono text-[10px] text-text-dim sm:inline-block">
              Esc
            </kbd>
          </div>

          {/* ── Results / hint ── */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {showHint ? (
              <PaletteHint />
            ) : flatItems.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-text-dim">
                {loading ? "Searching…" : "No matches. Try a different word."}
              </p>
            ) : (
              <FlatList items={flatItems} activeIdx={activeIdx} onPick={onPick} setActiveIdx={setActiveIdx} />
            )}
          </div>

          {/* ── Foot ── */}
          <div className="flex items-center justify-between gap-2 border-t border-line/10 bg-[rgb(var(--color-text-primary)/0.02)] px-4 py-2 font-mono text-[10px] text-text-dim">
            <span className="flex items-center gap-2">
              <kbd className="rounded border border-line/20 bg-[rgb(var(--color-text-primary)/0.04)] px-1.5 py-0.5">↑↓</kbd>
              navigate
              <kbd className="ml-2 rounded border border-line/20 bg-[rgb(var(--color-text-primary)/0.04)] px-1.5 py-0.5">⏎</kbd>
              open
            </span>
            <span>{loading ? "…" : `${flatItems.length} result${flatItems.length === 1 ? "" : "s"}`}</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ────────────────────────────────────────────────────────────── */

function PaletteHint() {
  return (
    <div className="px-3 py-4">
      <p className="mb-3 text-[13px] font-medium text-text-muted">Quick links</p>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {STATIC_PAGES.slice(0, 8).map((p) => (
          <li key={p.key}>
            <a
              href={p.to}
              className="block rounded-lg border border-line/10 bg-[rgb(var(--color-text-primary)/0.02)] px-3 py-2 text-xs text-text-muted transition hover:border-primary/30 hover:text-text-primary"
            >
              {p.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 px-1 font-mono text-[10px] text-text-dim">
        Type ≥ {MIN_CHARS} characters to search problems, roadmaps, writeups, and portfolios.
      </p>
    </div>
  );
}

function FlatList({ items, activeIdx, onPick, setActiveIdx }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item, i) => (
        <li key={`${item.kind}:${item.id}`}>
          <button
            type="button"
            onMouseEnter={() => setActiveIdx(i)}
            onClick={() => onPick(item)}
            className={
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition " +
              (i === activeIdx
                ? "bg-primary/15 ring-1 ring-primary/30"
                : "hover:bg-[rgb(var(--color-text-primary)/0.04)]")
            }
          >
            <KindBadge kind={item.kind} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-text-primary">{item.label}</span>
              {item.hint && (
                <span className="block truncate font-mono text-[10px] text-text-dim">{item.hint}</span>
              )}
            </span>
            {i === activeIdx && (
              <kbd className="shrink-0 rounded border border-primary/40 bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] text-text-primary">
                ⏎
              </kbd>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function KindBadge({ kind }) {
  const map = {
    page:      { label: "Page",      cls: "bg-[rgb(var(--color-text-primary)/0.04)] text-text-muted" },
    problem:   { label: "Problem",   cls: "bg-primary/15 text-primary" },
    roadmap:   { label: "Roadmap",   cls: "bg-secondary/15 text-secondary" },
    writeup:   { label: "Writeup",   cls: "bg-warning/15 text-warning" },
    portfolio: { label: "Person",    cls: "bg-success/15 text-success" },
  };
  const spec = map[kind] || map.page;
  return (
    <span
      className={
        "inline-flex w-16 shrink-0 items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-medium " +
        spec.cls
      }
    >
      {spec.label}
    </span>
  );
}

/* ── Lamplight skin ───────────────────────────────────────────────
 * Same data and keyboard model as above; only the presentation differs.
 * The highlighted row carries a single framer `layoutId` slab that
 * glides between rows as ↑/↓ move, and each fresh result set cascades
 * in row by row.
 */

const LAMP_KIND = {
  page:      { label: "Page",    group: "Pages",    Icon: ArrowUpRight, tone: "text-text-muted" },
  problem:   { label: "Problem", group: "Problems", Icon: Puzzle,       tone: "text-primary" },
  roadmap:   { label: "Roadmap", group: "Roadmaps", Icon: Route,        tone: "text-secondary" },
  writeup:   { label: "Writeup", group: "Writeups", Icon: BookOpen,     tone: "text-[rgb(var(--violet))]" },
  portfolio: { label: "Person",  group: "People",   Icon: UserRound,    tone: "text-success" },
};

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i, 12) * 0.028, duration: 0.32, ease: [0.16, 1, 0.3, 1] },
  }),
};

function LampPalette({
  inputRef, q, setQ, onKey, onClose, onPick, showHint, loading, flatItems, activeIdx, setActiveIdx,
}) {
  const listRef = useRef(null);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    const row = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
  }, [activeIdx]);

  // A new key per result set replays the cascade when results change.
  const resultKey = flatItems.map((it) => `${it.kind}:${it.id}`).join("|");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-[rgba(4,3,10,0.72)] px-3 pt-[9vh] backdrop-blur-md sm:px-4 sm:pt-[12vh]"
      style={{ perspective: 1200 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: -18, scale: 0.97, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="lamp-panel lamp-panel--lit relative w-full max-w-2xl overflow-hidden shadow-[0_40px_120px_-40px_rgb(var(--lamp)/0.45)]"
      >
        {/* Lamp glow pooling at the top edge */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 -top-24 h-40 rounded-full bg-[radial-gradient(closest-side,rgb(var(--lamp)/0.22),transparent)]"
        />

        <div className="relative flex items-center gap-3 border-b border-[rgb(var(--rule))] px-4 py-3.5 sm:px-5">
          <Search className={cn("h-[18px] w-[18px] shrink-0 transition-colors", q ? "text-primary" : "text-text-dim")} strokeWidth={1.75} aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search problems, roadmaps, writeups, people…"
            aria-label="Search"
            className="h-8 w-full bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-dim"
            autoComplete="off"
            spellCheck={false}
          />
          {loading ? (
            <span aria-hidden="true" className="relative h-4 w-4 shrink-0">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
              <span className="absolute inset-[5px] rounded-full bg-primary" />
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="hidden h-7 shrink-0 items-center rounded-lg border border-[rgb(var(--rule))] px-2 text-[12px] text-text-dim transition hover:text-text-primary sm:inline-flex"
          >
            Esc
          </button>
        </div>

        <div ref={listRef} className="relative max-h-[60vh] overflow-y-auto overscroll-contain p-2">
          {showHint ? (
            <LampHint />
          ) : flatItems.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
              <p className="lamp-display text-lg text-text-primary">
                {loading ? "Looking through the stacks…" : "Nothing matches that"}
              </p>
              {!loading ? <p className="text-sm text-text-muted">Try a shorter word, or a problem&apos;s source.</p> : null}
            </div>
          ) : (
            <ul key={resultKey} className="space-y-0.5">
              {flatItems.map((item, i) => {
                const spec = LAMP_KIND[item.kind] || LAMP_KIND.page;
                const prev = flatItems[i - 1];
                const startsGroup = !prev || prev.kind !== item.kind;
                const active = i === activeIdx;
                return (
                  <motion.li key={`${item.kind}:${item.id}`} custom={i} variants={rowVariants} initial="hidden" animate="show">
                    {startsGroup ? (
                      <p className={cn("px-3 pb-1 text-[12px] font-medium text-text-dim", i > 0 && "pt-3")}>{spec.group}</p>
                    ) : null}
                    <button
                      type="button"
                      data-idx={i}
                      onMouseEnter={() => setActiveIdx(i)}
                      onClick={() => onPick(item)}
                      className="relative flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                    >
                      {active ? (
                        <motion.span
                          layoutId="lamp-palette-highlight"
                          transition={{ type: "spring", stiffness: 520, damping: 40 }}
                          className="absolute inset-0 rounded-xl border border-[rgb(var(--lamp)/0.32)] bg-[rgb(var(--lamp)/0.09)] shadow-[inset_3px_0_0_rgb(var(--lamp))]"
                        />
                      ) : null}
                      <span
                        className={cn(
                          "relative grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[rgb(var(--rule))] bg-surface/60",
                          spec.tone,
                        )}
                      >
                        <spec.Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        <span className="sr-only">{spec.label}</span>
                      </span>
                      <span className="relative min-w-0 flex-1">
                        <span className={cn("block truncate text-sm transition-colors", active ? "text-text-primary" : "text-text-muted")}>
                          {item.label}
                        </span>
                        {item.hint && <span className="block truncate text-[12px] text-text-dim">{item.hint}</span>}
                      </span>
                      {active ? (
                        <CornerDownLeft className="relative h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
                      ) : null}
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="relative flex items-center justify-between gap-2 border-t border-[rgb(var(--rule))] px-4 py-2.5 text-[12px] text-text-dim sm:px-5">
          <span className="hidden items-center gap-1.5 sm:flex">
            <LampKey>↑</LampKey><LampKey>↓</LampKey> to move
            <LampKey className="ml-2">↵</LampKey> to open
          </span>
          <span className="sm:hidden">Tap a result to open it</span>
          <span className="lamp-numerals">
            {loading ? "Searching…" : `${flatItems.length} result${flatItems.length === 1 ? "" : "s"}`}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LampKey({ children, className }) {
  return (
    <kbd className={cn("inline-grid h-5 min-w-5 place-items-center rounded-md border border-[rgb(var(--rule))] bg-surface/70 px-1 font-sans text-[11px] text-text-muted", className)}>
      {children}
    </kbd>
  );
}

function LampHint() {
  return (
    <div className="px-2 py-3">
      <p className="mb-2 px-1 text-[13px] font-medium text-text-muted">Jump to</p>
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {STATIC_PAGES.slice(0, 8).map((p, i) => (
          <motion.li key={p.key} custom={i} variants={rowVariants} initial="hidden" animate="show">
            <a
              href={p.to}
              className="group flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-[rgb(var(--rule))] bg-surface/50 px-3 py-2 text-[13px] text-text-muted transition hover:border-[rgb(var(--lamp)/0.4)] hover:bg-[rgb(var(--lamp)/0.06)] hover:text-text-primary"
            >
              <span className="truncate">{p.label}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" strokeWidth={1.75} aria-hidden="true" />
            </a>
          </motion.li>
        ))}
      </ul>
      <p className="mt-4 flex items-start gap-2 px-1 text-[12px] text-text-dim">
        <Sparkles className="mt-px h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
        Type {MIN_CHARS} or more letters to search problems, roadmaps, writeups and people.
      </p>
    </div>
  );
}
