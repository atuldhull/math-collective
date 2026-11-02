/**
 * SubmitProblemPage — /problems/submit
 *
 * Two-stage flow:
 *   1. Paste a URL — server fetches the page, AI drafts the
 *      catalogue fields, returns a JSON.
 *   2. Review + edit the draft, then submit to the moderation queue.
 *
 * The student can also skip the URL step and fill the form in
 * manually. Either way, the submission lands on the admin queue at
 * /admin/moderation and the catalogue stays clean until approval.
 */

import { useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, Plus, Send, Sparkles, X } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { problemSubmissions } from "@/lib/api";
import { PageHeader } from "@/components/lamp";

const SOURCES     = ["SIH", "GSoC", "Kaggle", "MLH", "Devfolio", "Unstop", "OpenSource"];
const DIFFS       = ["beginner", "intermediate", "advanced"];
const DOMAINS     = ["AI/ML", "Web", "Web3", "IoT", "Govt", "OpenSource", "Health", "FinTech", "Education", "Agriculture", "Robotics", "Gaming"];

function emptyDraft() {
  return {
    title:           "",
    description:     "",
    how_to_start:    "",
    domain:          "",
    difficulty:      "intermediate",
    organisation:    "",
    source:          "OpenSource",
    source_event:    "",
    official_url:    "",
    tags:            [],
    dataset_links:   [],
    resource_links:  [],
    source_url:      "",
    ai_drafted:      false,
  };
}

export default function SubmitProblemPage() {
  const navigate = useNavigate();
  const [url,    setUrl]    = useState("");
  const [draft,  setDraft]  = useState(emptyDraft());
  const [draftingFromUrl, setDraftingFromUrl] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [info,  setInfo]  = useState(null);

  const onDraftFromUrl = useCallback(async (e) => {
    e?.preventDefault();
    const u = url.trim();
    if (!u) return;
    setDraftingFromUrl(true);
    setError(null);
    setInfo(null);
    try {
      const { data } = await problemSubmissions.draftFromUrl(u);
      setDraft({ ...emptyDraft(), ...data, ai_drafted: true });
      setInfo("Draft ready — review every field carefully before submitting. The AI is a starting point, not the source of truth.");
    } catch (err) {
      setError(err?.response?.data?.error || "Couldn't draft from that URL.");
    } finally {
      setDraftingFromUrl(false);
    }
  }, [url]);

  const onSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await problemSubmissions.create(draft);
      navigate("/problems/submit/thanks");
    } catch (err) {
      setError(err?.response?.data?.error || "Couldn't submit.");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, draft, navigate]);

  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  // When an AI draft lands, sweep a lamp glow down the form so the
  // student sees every field that was just filled in for them.
  const formRef = useRef(null);
  useGSAP(() => {
    if (!info) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // GSAP can't tween through var(), so resolve the lamp colour once.
    const lamp = window.getComputedStyle(document.documentElement).getPropertyValue("--lamp").trim().split(/\s+/).join(",") || "182,160,255";
    gsap.fromTo(
      formRef.current.querySelectorAll("[data-field]"),
      { boxShadow: `0 0 0 1px rgba(${lamp},0.6), 0 0 28px -6px rgba(${lamp},0.65)`, y: 8 },
      { boxShadow: `0 0 0 0px rgba(${lamp},0), 0 0 0px 0px rgba(${lamp},0)`, y: 0, duration: 1.2, stagger: 0.06, ease: "power3.out", clearProps: "boxShadow,transform" },
    );
  }, { scope: formRef, dependencies: [info] });

  return (
    <div className="mx-auto w-full max-w-3xl pb-24">
      <Link to="/problems" className="mb-5 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-text-muted transition hover:text-primary">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Back to problems
      </Link>

      <PageHeader
        context="Contribute"
        title="Submit a problem"
        size="sm"
        description="Paste the URL of a Kaggle competition, SIH problem page, GSoC project, or open-source issue. The assistant drafts the catalogue fields; you review and submit. An admin approves it into the public list."
      />

      <ol className="relative space-y-6 pl-11 sm:pl-14">
        {/* The path connecting the two steps — draws as the page settles. */}
        <span aria-hidden="true" className="absolute bottom-6 left-[15px] top-6 w-px bg-[rgb(var(--rule))] sm:left-[19px]" />
        <motion.span
          aria-hidden="true"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: info ? 1 : 0.18 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute bottom-6 left-[15px] top-6 w-px origin-top bg-primary shadow-[0_0_10px_rgb(var(--lamp)/0.8)] sm:left-[19px]"
        />

        {/* Stage 1 — URL drafter */}
        <li className="relative" data-reveal="up">
          <StepDot n={1} lit />
          <section className="lamp-panel lamp-panel--lit p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.75} />
              Draft from a URL
            </h2>
            <form onSubmit={onDraftFromUrl} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.kaggle.com/competitions/..."
                className={INPUT + " flex-1 font-mono"}
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!url.trim() || draftingFromUrl}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-[rgb(var(--color-obsidian))] transition hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
              >
                {draftingFromUrl ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                )}
                {draftingFromUrl ? "Drafting…" : "Draft with AI"}
              </button>
            </form>
            <p className="mt-2.5 text-xs leading-5 text-text-dim">
              Daily cap: 10 drafts per student. Or skip this step and fill the form in by hand.
            </p>
          </section>
        </li>

        {/* Stage 2 — review/edit + submit */}
        <li className="relative" data-reveal="up">
          <StepDot n={2} lit={Boolean(info)} />
          <form ref={formRef} onSubmit={onSubmit} className="lamp-panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-text-primary">Review and submit</h2>

            <AnimatePresence>
              {info && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm leading-6 text-warning">{info}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <Field label="Title">
              <input
                value={draft.title}
                onChange={(e) => setField("title", e.target.value)}
                maxLength={200}
                required
                className={INPUT}
              />
            </Field>

            <Field label="Description" hint="What the problem is and what success looks like. 200-600 words is the sweet spot.">
              <textarea
                value={draft.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={8} maxLength={8000} required
                className={INPUT + " resize-y leading-6"}
              />
            </Field>

            <Field label="How to start" hint="2-3 paragraphs of practical first steps for someone new to this.">
              <textarea
                value={draft.how_to_start}
                onChange={(e) => setField("how_to_start", e.target.value)}
                rows={6} maxLength={4000}
                className={INPUT + " resize-y leading-6"}
              />
            </Field>

            <div className="grid gap-x-3 sm:grid-cols-3">
              <Field label="Source">
                <select
                  value={draft.source}
                  onChange={(e) => setField("source", e.target.value)}
                  className={INPUT}
                >
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Difficulty">
                <select
                  value={draft.difficulty}
                  onChange={(e) => setField("difficulty", e.target.value)}
                  className={INPUT + " capitalize"}
                >
                  {DIFFS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Domain">
                <input
                  list="domains-suggest"
                  value={draft.domain}
                  onChange={(e) => setField("domain", e.target.value)}
                  maxLength={40} required
                  className={INPUT}
                />
                <datalist id="domains-suggest">
                  {DOMAINS.map((d) => <option key={d} value={d} />)}
                </datalist>
              </Field>
            </div>

            <div className="grid gap-x-3 sm:grid-cols-2">
              <Field label="Organisation">
                <input
                  value={draft.organisation || ""}
                  onChange={(e) => setField("organisation", e.target.value)}
                  maxLength={120}
                  className={INPUT}
                />
              </Field>
              <Field label="Source event" hint='e.g. "SIH 2024" / "GSoC 2024"'>
                <input
                  value={draft.source_event || ""}
                  onChange={(e) => setField("source_event", e.target.value)}
                  maxLength={60}
                  className={INPUT}
                />
              </Field>
            </div>

            <Field label="Official URL">
              <input
                type="url"
                value={draft.official_url || ""}
                onChange={(e) => setField("official_url", e.target.value)}
                maxLength={500}
                className={INPUT + " font-mono text-xs"}
              />
            </Field>

            <Field label="Tags" hint="Comma-separated. Keep them short and lowercase (e.g. python, computer-vision).">
              <input
                value={(draft.tags || []).join(", ")}
                onChange={(e) => setField("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
                maxLength={400}
                className={INPUT + " font-mono text-xs"}
              />
            </Field>

            <LinkListEditor
              label="Dataset links"
              links={draft.dataset_links}
              kindKey="format"
              kindOptions={["csv", "images", "json", "parquet", "api", "geotiff"]}
              onChange={(arr) => setField("dataset_links", arr)}
            />
            <LinkListEditor
              label="Resource links"
              links={draft.resource_links}
              kindKey="kind"
              kindOptions={["docs", "tutorial", "repo", "paper", "video"]}
              onChange={(arr) => setField("resource_links", arr)}
            />

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            <div className="mt-7 flex flex-col items-stretch gap-2 border-t border-[rgb(var(--rule))] pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
              <Link to="/problems" className="order-2 inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-medium text-text-muted transition hover:bg-white/[0.04] hover:text-text-primary sm:order-1">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="order-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-[rgb(var(--color-obsidian))] shadow-[0_10px_30px_-12px_rgb(var(--lamp)/0.8)] transition hover:brightness-110 active:scale-[0.97] disabled:opacity-50 sm:order-2"
              >
                <Send className="h-4 w-4" strokeWidth={1.75} />
                {submitting ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          </form>
        </li>
      </ol>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

const INPUT = "min-h-[44px] w-full rounded-xl border border-[rgb(var(--rule))] bg-obsidian/50 px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-dim transition focus:border-primary/50 focus:outline-none focus:shadow-[0_0_0_4px_rgb(var(--lamp)/0.08)]";

function StepDot({ n, lit }) {
  return (
    <span
      aria-hidden="true"
      className={
        "absolute -left-11 top-5 grid h-8 w-8 place-items-center rounded-full text-sm font-semibold transition-colors duration-500 sm:-left-14 sm:h-10 sm:w-10 " +
        (lit
          ? "bg-primary text-[rgb(var(--color-obsidian))] shadow-[0_0_20px_rgb(var(--lamp)/0.6)]"
          : "border border-[rgb(var(--rule))] bg-surface text-text-muted")
      }
    >
      {n}
    </span>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="mt-4 block">
      <span className="text-[13px] font-medium text-text-muted">{label}</span>
      <div data-field className="mt-1.5 rounded-xl">{children}</div>
      {hint && <p className="mt-1.5 text-xs leading-5 text-text-dim">{hint}</p>}
    </label>
  );
}

function LinkListEditor({ label, links, kindKey, kindOptions, onChange }) {
  const add = () => onChange([...(links || []), { label: "", url: "" }]);
  const del = (i) => onChange(links.filter((_, idx) => idx !== i));
  const setAt = (i, patch) => onChange(links.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  const small = "min-h-[40px] rounded-xl border border-[rgb(var(--rule))] bg-obsidian/50 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim focus:border-primary/50 focus:outline-none";

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-text-muted">{label}</span>
        <button
          type="button"
          onClick={add}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium text-primary transition hover:bg-primary/10"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Add
        </button>
      </div>
      <div className="mt-2 space-y-2">
        <AnimatePresence initial={false}>
          {(links || []).map((l, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div data-field className="grid gap-1.5 rounded-xl sm:grid-cols-[1fr_1fr_110px_40px]">
                <input
                  value={l.label || ""}
                  onChange={(e) => setAt(i, { label: e.target.value })}
                  placeholder="Label" maxLength={120}
                  className={small}
                />
                <input
                  value={l.url || ""}
                  onChange={(e) => setAt(i, { url: e.target.value })}
                  placeholder="URL" maxLength={500}
                  className={small + " font-mono text-xs"}
                />
                <input
                  list={`${kindKey}-options-${i}`}
                  value={l[kindKey] || ""}
                  onChange={(e) => setAt(i, { [kindKey]: e.target.value })}
                  placeholder={kindKey} maxLength={40}
                  className={small}
                />
                <datalist id={`${kindKey}-options-${i}`}>
                  {kindOptions.map((k) => <option key={k} value={k} />)}
                </datalist>
                <button
                  type="button"
                  onClick={() => del(i)}
                  className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl text-sm text-danger transition hover:bg-danger/10"
                  aria-label="Remove link"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                  <span className="sm:hidden">Remove link</span>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
