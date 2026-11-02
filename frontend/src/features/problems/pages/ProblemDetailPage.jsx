/**
 * ProblemDetailPage — the "complete own space" for one problem.
 *
 * Routed at /problems/:slugOrId. Pulls the full record (description,
 * how_to_start, dataset_links, resource_links, tags, source, etc.)
 * and renders the four sections every problem ought to have:
 *
 *   1. Hero header — title + source pill + difficulty + tags
 *   2. The Problem — full description
 *   3. How to start — 2-3 paragraph getting-started guide
 *   4. Resources — official source, datasets (with format tag),
 *      references / tutorials / repos
 *
 * Markdown is rendered as plain text (with paragraph + bullet
 * breaks). The dataset rows show their declared format ("csv",
 * "images", "geotiff", "parquet") as a small badge so the student
 * knows what they're committing to download.
 */

import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Database, ExternalLink } from "lucide-react";
import { problems } from "@/lib/api";
import Loader from "@/components/ui/Loader";
import { PageHeader, EmptyState } from "@/components/lamp";
import EngagementPanel from "../components/EngagementPanel";
import AiCompanion from "../components/AiCompanion";
import ReadingCurve from "../components/ReadingCurve";
import { SourceBadge, DifficultyMeter } from "../components/ProblemMeta";
import BookmarkButton from "@/components/ui/BookmarkButton";
import { bookmarks as bookmarksApi } from "@/lib/api";

export default function ProblemDetailPage() {
  const { slugOrId } = useParams();
  const [state, setState] = useState({ problem: null, loading: true, error: null });
  // Initial bookmark state for the "Save" pill in the header. We
  // fetch this alongside the problem itself so the star isn't
  // empty-then-flips-true on first paint.
  const [savedInitial, setSavedInitial] = useState(false);
  // The reading column — drives the scroll-progress asymptote.
  const readRef = useRef(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ problem: null, loading: true, error: null });
    setSavedInitial(false);
    problems.get(slugOrId, { signal: ctrl.signal })
      .then(({ data }) => {
        setState({ problem: data, loading: false, error: null });
        // Now that we have the canonical id, ask if the viewer
        // already saved it. Non-blocking — if it fails the star just
        // shows as un-saved and the user can re-toggle.
        bookmarksApi.state("problem", [data.id], { signal: ctrl.signal })
          .then(({ data: map }) => setSavedInitial(Boolean(map?.[data.id])))
          .catch(() => {});
      })
      .catch((err) => {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        setState({
          problem: null,
          loading: false,
          error:   err?.response?.status === 404 ? "not-found" : (err?.response?.data?.error || "Failed to load problem"),
        });
      });
    return () => ctrl.abort();
  }, [slugOrId]);

  if (state.loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader variant="orbit" />
      </div>
    );
  }

  if (state.error === "not-found") {
    return (
      <div className="mx-auto w-full max-w-2xl py-12">
        <EmptyState
          title="This problem doesn't exist (anymore)."
          body="It may have been archived. The catalogue has everything that's still open."
          action={
            <Link
              to="/problems"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-medium text-primary transition hover:bg-primary/15"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              All problems
            </Link>
          }
        />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="mx-auto w-full max-w-2xl py-12">
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-sm text-danger">
          {state.error}
        </div>
      </div>
    );
  }

  const p = state.problem;
  const hasLinks = Boolean(p.official_url || p.dataset_links?.length || p.resource_links?.length);

  return (
    <article className="mx-auto w-full max-w-6xl pb-20">
      {/* Back link */}
      <Link
        to="/problems"
        className="mb-5 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-text-muted transition hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Catalogue
      </Link>

      {/* ── Header ── */}
      <PageHeader
        context={p.organisation || p.domain || "Problem statement"}
        title={p.title}
        curve={false}
        actions={<BookmarkButton type="problem" id={p.id} initial={savedInitial} withLabel />}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SourceBadge source={p.source} event={p.source_event} />
          <DifficultyMeter level={p.difficulty} />
          {p.domain && (
            <span className="rounded-lg bg-secondary/15 px-2 py-1 text-xs font-medium text-secondary">{p.domain}</span>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
        {/* ── Reading column ── */}
        <div ref={readRef} className="min-w-0">
          <Section title="The problem">
            <Prose text={p.description} lead />
          </Section>

          {p.how_to_start && (
            <Section title="How to start" accent>
              <Prose text={p.how_to_start} />
            </Section>
          )}

          {/* ── AI companion — collapsible Socratic Q&A scoped to this problem ── */}
          <AiCompanion slugOrId={p.slug || p.id} />
        </div>

        {/* ── Side panel: sticky on desktop, stacked under the reading column on phones ── */}
        <aside className={(hasLinks ? "" : "hidden lg:block ") + "min-w-0 lg:sticky lg:top-24 lg:self-start"}>
            <div className="lamp-panel p-5 max-lg:[&>*:nth-child(2)]:mt-0 max-lg:[&>*:nth-child(2)]:border-t-0 max-lg:[&>*:nth-child(2)]:pt-0" data-reveal="left">
              {/* Reading progress only means something beside the text it tracks. */}
              <div className="hidden lg:block">
                <p className="text-[13px] font-medium text-text-muted">Reading progress</p>
                <ReadingCurve targetRef={readRef} className="mt-2" />
              </div>

              {p.official_url && (
                <div className="mt-5 border-t border-[rgb(var(--rule))] pt-5">
                  <a
                    href={p.official_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-[rgb(var(--color-obsidian))] shadow-[0_10px_30px_-12px_rgb(var(--lamp)/0.8)] transition hover:brightness-110"
                  >
                    Open original page
                    <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                  </a>
                  <p className="mt-2 break-all font-mono text-[11px] leading-5 text-text-dim">{p.official_url}</p>
                </div>
              )}

              {p.dataset_links?.length > 0 && (
                <SideGroup title="Datasets" icon={Database}>
                  {p.dataset_links.map((link, i) => (
                    <LinkRow key={i} link={link} kindBadge={link.format} />
                  ))}
                </SideGroup>
              )}

              {p.resource_links?.length > 0 && (
                <SideGroup title="Resources" icon={BookOpen}>
                  {p.resource_links.map((link, i) => (
                    <LinkRow key={i} link={link} kindBadge={link.kind} />
                  ))}
                </SideGroup>
              )}
            </div>
          </aside>
      </div>

      <div className="max-w-4xl">
        {/* ── Engagement (interest beacon + writeups) ── */}
        <EngagementPanel slugOrId={p.slug || p.id} />

        {/* ── Tags footer ── */}
        {p.tags?.length > 0 && (
          <div data-stagger="scale" className="mt-12 flex flex-wrap gap-2 border-t border-[rgb(var(--rule))] pt-6">
            {p.tags.map((t) => (
              <Link
                key={t}
                to={`/problems?tag=${encodeURIComponent(t)}`}
                className="inline-flex min-h-[36px] items-center rounded-xl border border-[rgb(var(--rule))] px-3 text-[13px] text-text-muted transition hover:border-primary/40 hover:text-primary"
              >
                #{t}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Section({ title, accent = false, children }) {
  return (
    <section data-reveal="up" className="mt-10 first:mt-0">
      <h2 className={`mb-4 flex items-center gap-3 text-xl font-semibold sm:text-2xl ${accent ? "text-primary" : "text-text-primary"}`}>
        {title}
        <span aria-hidden="true" className="h-px flex-1 bg-[rgb(var(--rule))]" />
      </h2>
      <div className={accent ? "lamp-panel lamp-panel--lit p-5 sm:p-6" : ""}>
        {children}
      </div>
    </section>
  );
}

/**
 * Prose — render newline-separated text as <p> blocks. Splits on
 * blank lines for paragraph breaks. Doesn't run markdown — the
 * seed text is hand-written and reads cleanly as plain prose;
 * pulling in a markdown library for this would be overkill.
 *
 * Reading-room measure: ~66 characters, generous leading; the first
 * paragraph of the statement (`lead`) sets a touch larger.
 */
function Prose({ text, lead = false }) {
  if (!text) return null;
  const paragraphs = String(text).split(/\n\n+/).filter(Boolean);
  return (
    <div className="max-w-[66ch] space-y-4 break-words text-[1.0625rem] leading-[1.8] text-text-primary/90">
      {paragraphs.map((para, i) => (
        <p
          key={i}
          className={lead && i === 0 ? "text-[1.15rem] leading-[1.75] text-text-primary sm:text-[1.2rem]" : undefined}
        >
          {para}
        </p>
      ))}
    </div>
  );
}

function SideGroup({ title, icon: Icon, children }) {
  return (
    <div className="mt-5 border-t border-[rgb(var(--rule))] pt-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
        {title}
      </h3>
      <ul data-stagger="left" className="space-y-1.5">
        {children}
      </ul>
    </div>
  );
}

function LinkRow({ link, kindBadge }) {
  return (
    <li>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-start gap-3 rounded-xl p-2.5 transition hover:bg-white/[0.04]"
      >
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-dim transition group-hover:text-primary" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-5 text-text-primary group-hover:text-primary">{link.label}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-text-dim">{link.url}</p>
        </div>
        {kindBadge && (
          <span className="shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
            {kindBadge}
          </span>
        )}
      </a>
    </li>
  );
}
