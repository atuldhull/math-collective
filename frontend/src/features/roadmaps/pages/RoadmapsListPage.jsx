/**
 * RoadmapsListPage — /roadmaps
 *
 * Curated, sequenced learning paths. Each card shows progress
 * (done/total), topic, difficulty, and the elevator-pitch summary.
 * Clicking a card → /roadmaps/:slug for the timeline.
 *
 * Visual hierarchy mirrors the problems catalogue: tilting lamp panels,
 * the first featured roadmap lit and wider, progress bars that fill as
 * the cards arrive.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Clock, Compass, Plus } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { roadmaps as roadmapsApi, bookmarks as bookmarksApi } from "@/lib/api";
import Loader from "@/components/ui/Loader";
import BookmarkButton from "@/components/ui/BookmarkButton";
import { PageHeader, TiltPanel, EmptyState } from "@/components/lamp";
import { Flicker, ScrollCurve } from "@/components/motion/ScrollFx";
import { DifficultyMeter } from "@/features/problems/components/ProblemMeta";

export default function RoadmapsListPage() {
  const navigate = useNavigate();
  const [list,     setList]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [savedMap, setSavedMap] = useState({}); // roadmap id → bool
  const [creating, setCreating] = useState(false);

  // Bucket the list into featured / community-approved / mine
  // (draft|pending|rejected). We do this client-side from one
  // payload because the controller returns all three in one call.
  const featured  = list.filter((r) => r.is_featured && r.submission_status === "approved");
  const community = list.filter((r) => !r.is_featured && r.submission_status === "approved");
  const mine      = list.filter((r) => r.submission_status !== "approved");

  const onCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      // Bootstrap a minimal draft and shunt the author into the editor.
      // Title + summary + topic are all required at the DB level; we
      // pre-fill placeholders the user will overwrite immediately.
      const { data } = await roadmapsApi.create({
        title:      "Untitled roadmap",
        summary:    "A new learning path — write a one-liner here.",
        topic:      "General",
        difficulty: "intermediate",
      });
      navigate(`/roadmaps/${encodeURIComponent(data.slug)}/edit`);
    } catch (err) {
      alert(err?.response?.data?.error || "Couldn't create roadmap");
    } finally {
      setCreating(false);
    }
  }, [creating, navigate]);

  useEffect(() => {
    const ctrl = new AbortController();
    roadmapsApi.list({}, { signal: ctrl.signal })
      .then(({ data }) => {
        const rows = data.data || [];
        setList(rows);
        setLoading(false);
        // Background fetch of bookmark state — non-fatal.
        const ids = rows.map((r) => r.id);
        if (ids.length) {
          bookmarksApi.state("roadmap", ids, { signal: ctrl.signal })
            .then(({ data: map }) => setSavedMap(map || {}))
            .catch(() => {});
        }
      })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        setError(err?.response?.data?.error || "Couldn't load roadmaps");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  // Progress bars fill as their cards scroll into view.
  const root = useRef(null);
  useGSAP(() => {
    if (!list.length) return undefined;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const bars = gsap.utils.toArray(root.current.querySelectorAll("[data-fill]"));
      gsap.set(bars, { scaleX: 0 });
      ScrollTrigger.batch(bars, {
        start: "top 92%",
        once: true,
        onEnter: (batch) => gsap.to(batch, { scaleX: 1, duration: 1.4, ease: "expo.out", stagger: 0.08, delay: 0.25 }),
      });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [list.length], revertOnUpdate: true });

  return (
    <div ref={root} className="mx-auto w-full max-w-6xl pb-20">
      <PageHeader
        context="Roadmaps"
        title="Paths worth *walking*."
        description={'Sequenced paths from "I want to start" to "I shipped something defensible." Pick one, tick off steps as you go, share the progress.'}
        actions={
          <motion.button
            type="button"
            onClick={onCreate}
            disabled={creating}
            whileTap={{ scale: 0.96 }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-[rgb(var(--color-obsidian))] shadow-[0_10px_30px_-12px_rgb(var(--lamp)/0.8)] transition hover:brightness-110 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            {creating ? "Creating…" : "Create roadmap"}
          </motion.button>
        }
      />

      {/* The trail draws itself as you walk down into the list. */}
      <ScrollCurve className="mb-10 h-12 sm:h-16" start="top 92%" end="top 30%" />

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

      {!loading && !error && list.length === 0 && (
        <EmptyState
          title="No roadmaps yet."
          body="Check back soon, or write the first one yourself."
        />
      )}

      {/* Featured (admin-curated) */}
      {featured.length > 0 && (
        <Section title="Featured" subtitle="Hand-picked by Asymptotes">
          <CardGrid items={featured} savedMap={savedMap} featured />
        </Section>
      )}

      {/* Community-approved */}
      {community.length > 0 && (
        <Section title="From the community" subtitle="Written and shared by other students">
          <CardGrid items={community} savedMap={savedMap} />
        </Section>
      )}

      {/* Your own work-in-progress / pending / rejected */}
      {mine.length > 0 && (
        <Section title="Your roadmaps" subtitle="Drafts, pending review, and rejected">
          <CardGrid items={mine} savedMap={savedMap} />
        </Section>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Section({ title, subtitle, children }) {
  return (
    <section className="mt-12 first:mt-0">
      <div className="mb-5">
        <Flicker as="h2" className="text-2xl font-semibold text-text-primary">{title}</Flicker>
        {subtitle && <p data-reveal="fade" className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function CardGrid({ items, savedMap, featured = false }) {
  return (
    <div data-stagger="fog" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r, i) => (
        <RoadmapCard
          key={r.id}
          r={r}
          saved={Boolean(savedMap[r.id])}
          lit={featured && i === 0}
          wide={featured && i === 0 && items.length > 1}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

const STATUS_TONE = {
  draft:    "bg-white/[0.06] text-text-muted ring-[rgb(var(--rule))]",
  pending:  "bg-warning/10 text-warning ring-warning/30",
  rejected: "bg-danger/10 text-danger ring-danger/30",
};

function RoadmapCard({ r, saved, lit, wide }) {
  const pct = r.step_count > 0 ? Math.round((r.done_count / r.step_count) * 100) : 0;

  return (
    <div className={"relative " + (wide ? "sm:col-span-2" : "")}>
      {/* Bookmark — absolutely positioned so the click doesn't
          bubble through to the Link. */}
      <div className="absolute right-3 top-3 z-10">
        <BookmarkButton type="roadmap" id={r.id} initial={saved} compact />
      </div>
      <TiltPanel
        as={Link}
        lit={lit}
        to={`/roadmaps/${encodeURIComponent(r.slug)}`}
        className="group flex h-full flex-col p-5 transition-colors hover:border-primary/35 sm:p-6"
      >
        <div className="flex items-center gap-3 pr-10">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.05] text-[1.7rem] leading-none transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" aria-hidden="true">
            {r.cover_emoji || <Compass className="h-6 w-6 text-primary" strokeWidth={1.75} />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-text-muted">{r.topic}</p>
            <DifficultyMeter level={r.difficulty} />
          </div>
        </div>

        <h3
          className={"mt-4 font-semibold leading-snug text-text-primary transition-colors group-hover:text-primary " + (wide ? "text-2xl" : "text-lg")}
          style={{ textWrap: "balance" }}
        >
          {r.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-muted">{r.summary}</p>

        <div className="mt-auto pt-5">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-text-dim">
            <span className="tabular-nums">
              {r.done_count} of {r.step_count} steps
              {r.est_hours ? <span className="ml-2 inline-flex items-center gap-1"><Clock className="inline h-3 w-3" strokeWidth={1.75} />{r.est_hours}h</span> : null}
            </span>
            {STATUS_TONE[r.submission_status] ? (
              <span className={"rounded-md px-1.5 py-0.5 font-medium capitalize ring-1 " + STATUS_TONE[r.submission_status]}>{r.submission_status}</span>
            ) : (
              <span className={"lamp-numerals " + (pct > 0 ? "text-primary" : "")}>{pct}%</span>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              data-fill
              className="h-full origin-left rounded-full bg-primary shadow-[0_0_10px_rgb(var(--lamp)/0.6)]"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </TiltPanel>
    </div>
  );
}
