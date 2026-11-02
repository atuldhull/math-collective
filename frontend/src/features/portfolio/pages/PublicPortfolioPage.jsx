/**
 * PublicPortfolioPage — /u/:handle
 *
 * Auth-FREE shareable portfolio. Pulls a single aggregated payload
 * (/api/portfolio/:handle) and renders the student's writeups,
 * projects, achievements, certificates, and completed roadmaps in a
 * single-column layout designed to look good when pasted on LinkedIn
 * or in a résumé bullet.
 *
 * If the handle is unknown OR the owner hasn't opted in, the API
 * returns 404 — we render a generic "not available" page so we don't
 * leak which handles exist privately.
 *
 * No org context, no friends list, no clickstream. Strictly the
 * student's *artifacts*.
 */

import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { ArrowUp, ArrowUpRight, Award, Check, FileBadge } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { portfolio } from "@/lib/api";
import Loader from "@/components/ui/Loader";
import { AsymptoteCurve, EmptyState, StatTile, TiltPanel } from "@/components/lamp";

const RARITY_COLOR = {
  common:    "rgba(148, 163, 184, 0.4)",
  uncommon:  "rgba(110, 231, 183, 0.4)",
  rare:      "rgba(147, 197, 253, 0.45)",
  epic:      "rgba(216, 180, 254, 0.45)",
  legendary: "rgba(252, 211, 77, 0.5)",
};

const motionOK = () =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

export default function PublicPortfolioPage() {
  const { handle } = useParams();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ data: null, loading: true, error: null });
    portfolio.public(handle, { signal: ctrl.signal })
      .then(({ data }) => setState({ data, loading: false, error: null }))
      .catch((err) => {
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
        setState({
          data: null, loading: false,
          error: err?.response?.status === 404 ? "not-found" : (err?.response?.data?.error || "Couldn't load portfolio"),
        });
      });
    return () => ctrl.abort();
  }, [handle]);

  if (state.loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader variant="orbit" /></div>;
  }

  if (state.error === "not-found") {
    return (
      <div className="mx-auto w-full max-w-2xl py-16">
        <EmptyState
          title="Portfolio not available"
          body={<>The owner of <span className="font-mono text-text-primary">@{handle}</span> hasn&rsquo;t made their portfolio public, or this handle doesn&rsquo;t exist.</>}
          action={(
            <Link
              to="/"
              className="inline-flex h-11 items-center rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-5 text-sm font-medium text-text-primary transition hover:border-[rgb(var(--lamp)/0.45)]"
            >
              Go to Asymptotes
            </Link>
          )}
        />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="mx-auto w-full max-w-2xl py-20">
        <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-6 text-sm text-danger">
          {state.error}
        </div>
      </div>
    );
  }

  const d = state.data;

  return (
    <article className="mx-auto w-full max-w-4xl pb-24 pt-2 sm:pt-6">
      <ProfileHero d={d} />

      {/* ── Writeups ── */}
      {d.writeups?.length > 0 && (
        <Section title="Writeups" count={d.writeups.length}>
          <div data-stagger="up" className="space-y-3">
            {d.writeups.map((w) => (
              <article key={w.id} className="lamp-panel p-4 sm:p-5">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-text-primary">{w.title}</h3>
                  <span className="inline-flex items-center gap-2 text-[13px] text-text-dim">
                    <span className="inline-flex items-center gap-1 text-primary">
                      <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                      <span className="tabular-nums">{w.vote_count}</span>
                      <span className="sr-only">votes</span>
                    </span>
                    {new Date(w.created_at).toLocaleDateString()}
                  </span>
                </header>
                {w.problem && (
                  <p className="mt-1 text-[13px] font-medium text-primary">
                    {w.problem.title} <span className="text-text-dim">from {w.problem.source}</span>
                  </p>
                )}
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-text-muted">{w.body}</p>
                {w.repo_url && (
                  <a
                    href={w.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 break-all font-mono text-[12px] text-primary hover:underline"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    {w.repo_url.replace(/^https?:\/\//, "").slice(0, 60)}
                  </a>
                )}
              </article>
            ))}
          </div>
        </Section>
      )}

      {/* ── Projects ── */}
      {d.projects?.length > 0 && (
        <Section title="Projects" count={d.projects.length}>
          <div data-stagger="tilt" className="grid gap-3 sm:grid-cols-2">
            {d.projects.map((p) => (
              <TiltPanel key={p.id} className="p-4 sm:p-5">
                <div className="relative">
                  <h3 className="text-base font-semibold text-text-primary">{p.title}</h3>
                  {p.category && (
                    <p className="mt-0.5 text-[13px] text-text-dim">{p.category}</p>
                  )}
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-muted">{p.description}</p>
                  {(p.github_url || p.demo_url) && (
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] font-medium">
                      {p.github_url && (
                        <a href={p.github_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          GitHub <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                        </a>
                      )}
                      {p.demo_url && (
                        <a href={p.demo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          Live demo <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </TiltPanel>
            ))}
          </div>
        </Section>
      )}

      {/* ── Roadmaps completed ── */}
      {d.roadmaps_completed?.length > 0 && (
        <Section title="Roadmaps completed" count={d.roadmaps_completed.length}>
          <div data-stagger="scale" className="flex flex-wrap gap-2">
            {d.roadmaps_completed.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/[0.08] px-3 py-1.5 text-sm text-success"
                title={r.title}
              >
                <span aria-hidden="true">{r.cover_emoji || <Check className="h-3.5 w-3.5" strokeWidth={2} />}</span>
                {r.title}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ── Achievements ── */}
      {d.achievements?.length > 0 && (
        <Section title="Achievements" count={d.achievements.length}>
          <div data-stagger="scale" className="grid gap-2.5 sm:grid-cols-2">
            {d.achievements.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-xl border bg-surface/55 p-3.5"
                style={{ borderColor: RARITY_COLOR[a.rarity] || RARITY_COLOR.common }}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-2xl leading-none"
                  style={{ background: (RARITY_COLOR[a.rarity] || RARITY_COLOR.common).replace(/[\d.]+\)$/, "0.12)") }}
                  aria-hidden="true"
                >
                  {a.icon || <Award className="h-5 w-5 text-text-primary" strokeWidth={1.75} />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{a.title}</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-text-muted">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Certificates ── */}
      {d.certificates?.length > 0 && (
        <Section title="Certificates" count={d.certificates.length}>
          <ul data-stagger="left" className="divide-y divide-[rgb(var(--rule))] overflow-hidden rounded-2xl border border-[rgb(var(--rule))] bg-surface/50">
            {d.certificates.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <FileBadge className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
                <p className="min-w-0 flex-1 text-sm text-text-primary">{c.event_name}</p>
                <p className="shrink-0 text-[13px] tabular-nums text-text-dim">
                  {new Date(c.issued_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Empty-but-public state */}
      {d.writeups?.length === 0 &&
       d.projects?.length === 0 &&
       d.achievements?.length === 0 &&
       d.certificates?.length === 0 &&
       d.roadmaps_completed?.length === 0 && (
        <EmptyState
          compact
          className="mt-12"
          title={`@${d.handle} is just getting started`}
          body="Writeups, projects and certificates will show up here as they earn them. Check back soon."
        />
      )}

      {/* Footer attribution */}
      <p data-reveal="fade" className="mt-16 text-center text-[13px] text-text-dim">
        A portfolio on <Link to="/" className="text-text-muted underline-offset-4 hover:text-primary hover:underline">Asymptotes</Link>
      </p>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────── */

/**
 * ProfileHero — the avatar sits at the centre of a small orbit (two
 * dashed rings turning opposite ways, a lamp dot circling), the name
 * rises word by word, and as the page scrolls the orbit drifts up and
 * the panel settles back, so the hero hands over to the work below.
 */
function ProfileHero({ d }) {
  const root = useRef(null);
  const words = String(d.name || "").split(" ");

  useGSAP(() => {
    if (!motionOK()) return;
    const q = gsap.utils.selector(root);
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(q("[data-orbit-ring]"), { scale: 0.3, autoAlpha: 0, duration: 1.6, stagger: 0.12 }, 0)
      .from(q("[data-avatar]"), { scale: 0, rotate: -25, duration: 1.2, ease: "back.out(1.8)" }, 0.2)
      .from(q("[data-name-word]"), { yPercent: 115, rotate: 5, duration: 1.1, stagger: 0.07 }, 0.3)
      .from(q("[data-hero-meta] > *"), { y: 16, autoAlpha: 0, duration: 0.8, stagger: 0.07 }, 0.55)
      .from(q("[data-social]"), { y: 10, autoAlpha: 0, scale: 0.9, duration: 0.6, stagger: 0.05 }, 0.75)
      .from(q("[data-hero-stats] > *"), { rotateX: -60, y: 30, autoAlpha: 0, transformPerspective: 800, transformOrigin: "50% 100%", duration: 1, stagger: 0.1 }, 0.8);

    gsap.to(q("[data-orbit-a]"), { rotate: 360, duration: 26, ease: "none", repeat: -1 });
    gsap.to(q("[data-orbit-b]"), { rotate: -360, duration: 38, ease: "none", repeat: -1 });
    gsap.to(q("[data-orbit-dot]"), { rotate: 360, duration: 7, ease: "none", repeat: -1 });

    // Scroll away: orbit lifts faster than the text, panel eases back.
    gsap.to(q("[data-orbit]"), {
      yPercent: -28, ease: "none",
      scrollTrigger: { trigger: root.current, start: "top top+=80", end: "bottom top", scrub: 0.8 },
    });
    gsap.to(q("[data-hero-panel]"), {
      scale: 0.96, autoAlpha: 0.55, ease: "none",
      scrollTrigger: { trigger: root.current, start: "center top+=120", end: "bottom top", scrub: 0.8 },
    });
  }, { scope: root });

  return (
    <header ref={root} className="relative">
      <div data-hero-panel className="lamp-panel lamp-panel--lit relative overflow-hidden p-5 sm:p-9">
        <AsymptoteCurve tone="violet" className="pointer-events-none absolute -bottom-2 right-0 h-28 w-[22rem] max-w-[80%] opacity-40" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-9">
          {/* orbit */}
          <div data-orbit className="relative grid h-36 w-36 shrink-0 place-items-center self-center sm:h-44 sm:w-44 sm:self-auto">
            <span data-orbit-ring data-orbit-a aria-hidden="true" className="absolute inset-0 rounded-full border border-dashed border-[rgb(var(--lamp)/0.45)]" />
            <span data-orbit-ring data-orbit-b aria-hidden="true" className="absolute inset-[12%] rounded-full border border-dashed border-[rgb(var(--violet)/0.5)]" />
            <span data-orbit-dot aria-hidden="true" className="absolute inset-0">
              <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_rgb(var(--lamp)/0.9)]" />
            </span>
            <div
              data-avatar
              className="relative grid h-20 w-20 place-items-center rounded-2xl text-4xl shadow-[0_18px_40px_-14px_rgb(var(--lamp)/0.6)] sm:h-24 sm:w-24 sm:text-5xl"
              style={{ background: d.avatar?.color || "linear-gradient(135deg, rgb(var(--violet)), rgb(var(--lamp)))" }}
            >
              {d.avatar?.emoji || (
                <span className="lamp-display text-[rgb(var(--color-obsidian))]">{String(d.name || d.handle || "?").charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="lamp-display text-[2.2rem] leading-[1.02] text-text-primary sm:text-5xl" style={{ textWrap: "balance" }}>
              {words.map((w, i) => (
                <span key={`${w}-${i}`} className="lamp-word">
                  <span data-name-word>{w}{i < words.length - 1 ? " " : ""}</span>
                </span>
              ))}
            </h1>
            <div data-hero-meta>
              <p className="mt-2 text-sm text-text-muted">
                <span className="font-mono text-primary">@{d.handle}</span>
                {d.title ? <span className="ml-2">{d.title}</span> : null}
              </p>
              {d.headline && (
                <p className="mt-3 text-base leading-7 text-text-primary/85" style={{ textWrap: "balance" }}>
                  {d.headline}
                </p>
              )}
            </div>

            {/* Socials */}
            {d.socials && Object.keys(d.socials).length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                {Object.entries(d.socials).map(([k, v]) => (
                  <a
                    key={k}
                    data-social
                    href={absoluteUrl(v)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[rgb(var(--rule))] bg-white/[0.04] px-3.5 text-[13px] font-medium capitalize text-text-muted transition hover:border-[rgb(var(--lamp)/0.45)] hover:text-text-primary"
                  >
                    {k}
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {d.bio && (
          <p className="relative mt-6 max-w-[68ch] border-t border-[rgb(var(--rule))] pt-5 text-sm leading-7 text-text-muted">{d.bio}</p>
        )}
      </div>

      {/* Stat row */}
      <div data-hero-stats className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
        <StatTile label="XP" value={Number(d.stats?.xp) || 0} className="p-3.5 sm:p-5" />
        <StatTile label="Streak" value={Number(d.stats?.streak_days) || 0} suffix="d" className="p-3.5 sm:p-5" />
        <StatTile label="Joined" value={d.stats?.joined ? String(new Date(d.stats.joined).getFullYear()) : "—"} className="p-3.5 sm:p-5" />
      </div>
    </header>
  );
}

function Section({ title, count, children }) {
  return (
    <section className="mt-12">
      <div data-reveal="left" className="mb-4 flex items-baseline gap-3">
        <h2 className="text-xl text-text-primary sm:text-2xl">{title}</h2>
        {typeof count === "number" ? <span className="text-[13px] tabular-nums text-text-dim">{count}</span> : null}
        <span aria-hidden="true" className="h-px flex-1 self-center bg-[linear-gradient(90deg,rgb(var(--rule)),transparent)]" />
      </div>
      {children}
    </section>
  );
}

// Tolerate bare social usernames in the socials JSON ("github": "atul-dhull")
// — render them with a sensible base. Users can also paste full URLs;
// we pass those through unchanged.
function absoluteUrl(v) {
  const s = String(v || "").trim();
  if (!s) return "#";
  if (/^https?:\/\//i.test(s)) return s;
  return "https://" + s.replace(/^\/+/, "");
}
