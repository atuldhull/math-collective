/**
 * ProblemsListPage — browseable index of problem statements
 * (SIH / GSoC / Kaggle / MLH / Devfolio / Unstop / OpenSource).
 *
 * Auth-gated by the parent route's <ProtectedRoute>. Anyone with a
 * student / teacher / admin session sees the same catalogue.
 *
 * Filters (server-side):
 *   q          free-text title + description search
 *   source     SIH | GSoC | Kaggle | MLH | Devfolio | Unstop | OpenSource
 *   domain     AI/ML | Govt | Web | Web3 | IoT | OpenSource | ...
 *   difficulty beginner | intermediate | advanced
 *   tag        repeatable; AND of tags
 *
 * UX choices
 *   - Cards (not table) so each problem feels like a project you'd
 *     pick up, not a row to triage.
 *   - Filters live in a bar under the page header; on phones the
 *     chip rows collapse behind a "Filters" toggle. The URL holds the
 *     filter state so a student can deep-link "AI/ML beginner problems
 *     from Kaggle" to a friend.
 *   - Pagination not infinite-scroll — students searching for a
 *     specific problem need a stable address bar.
 */

import { useEffect, useId, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { problems, bookmarks as bookmarksApi } from "@/lib/api";
import Loader from "@/components/ui/Loader";
import BookmarkButton from "@/components/ui/BookmarkButton";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { PageHeader, TiltPanel, EmptyState } from "@/components/lamp";
import { ScrollCurve } from "@/components/motion/ScrollFx";
import { cn } from "@/lib/cn";
import { SOURCE_HUE, SourceBadge, DifficultyMeter } from "@/features/problems/components/ProblemMeta";

const PAGE_SIZE = 24;

export default function ProblemsListPage() {
  const [params, setParams] = useSearchParams();
  const [state,  setState]  = useState({ data: [], total: 0, loading: true, error: null });
  const [facets, setFacets] = useState({ domains: [], sources: [], tags: [] });
  // Bookmark state for the currently-loaded page of problems. Keyed
  // by problem id → boolean. Populated by a single batch call after
  // the page lands so each card knows its initial saved state
  // without N+1 round trips.
  const [savedMap, setSavedMap] = useState({});
  // Mobile: the source/domain/difficulty chip rows are hidden by
  // default behind a "Filters" toggle so students don't have to
  // scroll past the entire option pile to see the first result. On
  // lg+ the rows are always visible (state ignored).
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Derived filter values from URL — single source of truth so
  // back/forward + deep-links work for free.
  const q          = params.get("q")          || "";
  const source     = params.get("source")     || "";
  const domain     = params.get("domain")     || "";
  const difficulty = params.get("difficulty") || "";
  const page       = Math.max(1, Number(params.get("page")) || 1);

  // Load facets once. Doesn't change as filters change — it's the
  // FULL set of options across every active problem, so the
  // dropdowns don't shrink when the user narrows their search.
  useEffect(() => {
    let cancelled = false;
    problems.facets().then(({ data }) => {
      if (!cancelled) setFacets(data);
    }).catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, []);

  // Re-fetch results whenever a filter changes. AbortController so
  // a rapid filter change doesn't race the previous fetch.
  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    setSavedMap({});  // clear stale stars while the new page loads
    problems
      .list({ q, source, domain, difficulty, page, limit: PAGE_SIZE }, { signal: ctrl.signal })
      .then(({ data }) => {
        setState({ data: data.data, total: data.total, loading: false, error: null });
        // Bulk-fetch bookmark state for the visible page in the
        // background — the page renders without waiting for it.
        const ids = (data.data || []).map((p) => p.id);
        if (ids.length) {
          bookmarksApi.state("problem", ids, { signal: ctrl.signal })
            .then(({ data: map }) => setSavedMap(map || {}))
            .catch(() => { /* non-fatal — stars stay un-pre-filled */ });
        }
      })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        setState({ data: [], total: 0, loading: false, error: err?.response?.data?.error || "Failed to load problems" });
      });
    return () => ctrl.abort();
  }, [q, source, domain, difficulty, page]);

  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));

  // Update a single filter slot. Resetting `page` to 1 on any
  // filter change is the expected behaviour (a deeper page would
  // probably be out-of-range for the narrower result set).
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: false });
  };

  const clearAll = () => setParams(new URLSearchParams(), { replace: false });
  const hasFilters = q || source || domain || difficulty;
  const activeCount = [source, domain, difficulty].filter(Boolean).length;

  return (
    <div className="mx-auto w-full max-w-7xl pb-20">
      <PageHeader
        context="Problem repository"
        title="Real-world problems to actually build."
        description={'Hand-curated problem statements from SIH, GSoC, Kaggle, MLH and the open-source world. Each one has the official source, datasets if any, and a short "how to start" so you don\'t stare at a blank file.'}
        actions={
          <Link
            to="/problems/submit"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-[rgb(var(--color-obsidian))] shadow-[0_10px_30px_-12px_rgb(var(--lamp)/0.8)] transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Submit problem
          </Link>
        }
      >
        {/* ── Filter bar ── */}
        <div className="lamp-panel p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Search — always visible on every breakpoint. The one
                filter students reach for constantly. */}
            <SearchBox value={q} onChange={(v) => setFilter("q", v)} />

            {/* Mobile-only "Filters" toggle. On lg+ it hides and the
                chip rows below are always rendered. */}
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-3.5 text-sm font-medium text-text-muted transition hover:border-primary/40 hover:text-text-primary lg:hidden"
            >
              Filters
              {hasFilters && (
                <span className="rounded-full bg-primary/20 px-1.5 text-[11px] text-primary">
                  {activeCount || "active"}
                </span>
              )}
              <ChevronDown
                className={cn("h-4 w-4 transition-transform duration-300", filtersOpen && "rotate-180")}
                strokeWidth={1.75}
              />
            </button>

            <p className="ml-auto hidden text-[13px] font-medium text-text-muted sm:block" aria-live="polite">
              {state.loading
                ? "Loading…"
                : <><AnimatedNumber value={state.total} duration={0.8} /> problem{state.total === 1 ? "" : "s"}</>}
            </p>
          </div>

          {/* Chip rows — collapsed by default on mobile, always
              visible on lg. The `lg:!grid` override beats `hidden`. */}
          <div className={cn("mt-3 gap-3 border-t border-[rgb(var(--rule))] pt-3", filtersOpen ? "grid" : "hidden", "lg:!grid")}>
            <FilterGroup
              label="Source"
              value={source}
              onChange={(v) => setFilter("source", v)}
              options={facets.sources}
              hue={(opt) => SOURCE_HUE[opt]}
            />
            <FilterGroup
              label="Domain"
              value={domain}
              onChange={(v) => setFilter("domain", v)}
              options={facets.domains}
            />
            <FilterGroup
              label="Difficulty"
              value={difficulty}
              onChange={(v) => setFilter("difficulty", v)}
              options={["beginner", "intermediate", "advanced"]}
            />
            {hasFilters && (
              <div>
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-text-muted transition hover:bg-white/[0.04] hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </PageHeader>

      {/* ── Results ── */}
      <section>
        <ScrollCurve tone="violet" className="mb-6 h-10 sm:h-12" start="top 92%" end="top 40%" />
        <p className="mb-4 text-[13px] font-medium text-text-muted sm:hidden">
          {state.loading
            ? "Loading…"
            : `${state.total.toLocaleString()} problem${state.total === 1 ? "" : "s"}`}
        </p>

        {state.loading && (
          <div className="flex justify-center py-20">
            <Loader variant="orbit" />
          </div>
        )}

        {state.error && !state.loading && (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-sm text-danger">
            {state.error}
          </div>
        )}

        {!state.loading && !state.error && state.data.length === 0 && (
          <EmptyState
            title="No problems match these filters."
            body="Try clearing one of them, or search for a broader word."
            action={hasFilters ? (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex min-h-[44px] items-center rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-medium text-primary transition hover:bg-primary/15"
              >
                Clear filters
              </button>
            ) : null}
          />
        )}

        {!state.loading && state.data.length > 0 && (
          <ul data-stagger="fog" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {state.data.map((p, i) => (
              <ProblemCard key={p.id} p={p} index={i} saved={Boolean(savedMap[p.id])} />
            ))}
          </ul>
        )}

        {/* Pagination */}
        {!state.loading && totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onChange={(n) => setFilter("page", String(n))} />
        )}
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function SearchBox({ value, onChange }) {
  // Debounce so every keystroke doesn't fire a fetch — 250ms matches
  // the perceptual "I'm done typing" window for English speakers.
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (local !== value) onChange(local);
    }, 250);
    return () => clearTimeout(t);
  }, [local, value, onChange]);

  return (
    <label className="relative min-w-0 flex-1 basis-[220px]">
      <span className="sr-only">Search</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" strokeWidth={1.75} />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="theorem, OCR, blockchain…"
        className="min-h-[44px] w-full rounded-xl border border-[rgb(var(--rule))] bg-obsidian/40 py-2 pl-10 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/50 focus:shadow-[0_0_0_4px_rgb(var(--lamp)/0.08)]"
      />
    </label>
  );
}

function FilterGroup({ label, value, onChange, options, hue }) {
  const sliderId = useId();
  if (!options?.length) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-4">
      <p className="w-20 shrink-0 text-[13px] font-medium text-text-muted">{label}</p>
      <div className="scrollbar-none -mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 pb-0.5 lg:flex-wrap lg:overflow-visible">
        {options.map((opt) => {
          const active = value === opt;
          const h = hue?.(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? "" : opt)}
              aria-pressed={active}
              className={cn(
                "relative inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] capitalize transition-colors sm:min-h-[34px]",
                active ? "text-text-primary" : "text-text-muted hover:bg-white/[0.04] hover:text-text-primary",
              )}
            >
              {active && (
                <motion.span
                  layoutId={sliderId}
                  className="absolute inset-0 rounded-xl border border-primary/45 bg-primary/15"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              {h && (
                <span
                  aria-hidden="true"
                  className="relative h-2 w-2 rounded-full"
                  style={{ background: `rgb(${h})`, boxShadow: active ? `0 0 10px rgb(${h})` : "none" }}
                />
              )}
              <span className="relative">{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProblemCard({ p, saved }) {
  return (
    <li className="relative">
      {/* Bookmark sits OUTSIDE the <Link> so a click on it doesn't
          navigate. Absolutely positioned over the card's top-right. */}
      <div className="absolute right-3 top-3 z-10">
        <BookmarkButton type="problem" id={p.id} initial={saved} compact />
      </div>

      <TiltPanel
        as={Link}
        to={`/problems/${p.slug || p.id}`}
        className="group flex h-full flex-col p-5 transition-colors hover:border-primary/30"
      >
        <div className="mb-4 flex min-w-0 items-center gap-3 pr-10">
          <SourceBadge source={p.source} event={p.source_event} />
          <DifficultyMeter level={p.difficulty} />
        </div>

        <h3 className="text-[1.05rem] font-semibold leading-snug text-text-primary transition-colors group-hover:text-primary">
          {p.title}
        </h3>

        {p.organisation && (
          <p className="mt-2 text-[13px] text-text-muted">{p.organisation}</p>
        )}

        <div className="mt-auto pt-5">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {(p.tags || []).slice(0, 4).map((t) => (
              <span key={t} className="text-xs text-text-dim">
                #{t}
              </span>
            ))}
          </div>
        </div>
      </TiltPanel>
    </li>
  );
}

function Pagination({ page, totalPages, onChange }) {
  // 7-window pagination — first, last, current, current ±2,
  // ellipses for gaps. Keeps the pager visually consistent at any
  // page count.
  const window = useMemo(() => {
    const pages = new Set([1, totalPages, page, page - 1, page + 1, page - 2, page + 2]);
    return [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  }, [page, totalPages]);

  const base = "flex h-10 min-w-[40px] items-center justify-center rounded-xl px-3 text-sm tabular-nums transition";

  return (
    <nav data-reveal="fade" className="mt-10 flex flex-wrap items-center justify-center gap-1">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
        className={cn(base, "border border-[rgb(var(--rule))] text-text-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30")}
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {window.map((n, i) => {
        const gap = i > 0 && n - window[i - 1] > 1;
        return (
          <span key={n} className="flex items-center gap-1">
            {gap && <span className="px-1 text-text-dim">…</span>}
            <button
              onClick={() => onChange(n)}
              aria-label={`Page ${n}`}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                base,
                n === page
                  ? "bg-primary font-semibold text-[rgb(var(--color-obsidian))]"
                  : "border border-[rgb(var(--rule))] text-text-muted hover:border-primary/30 hover:text-text-primary",
              )}
            >
              {n}
            </button>
          </span>
        );
      })}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
        className={cn(base, "border border-[rgb(var(--rule))] text-text-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30")}
      >
        <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </nav>
  );
}
