/**
 * AdminModerationPage — /admin/moderation
 *
 * Two queues for admin/teacher moderation:
 *   1. Community roadmap submissions — Approve / Feature / Reject.
 *   2. Problem-statement submissions (drafted via AI assistant) —
 *      Approve into the catalogue / Reject.
 *
 * Single page, two tabs. The tab is URL-driven (?tab=...) so an
 * admin can deep-link straight to one queue from a notification.
 */

import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Compass, ExternalLink, Star, X } from "lucide-react";
import { roadmaps as roadmapsApi, problemSubmissions } from "@/lib/api";
import Loader from "@/components/ui/Loader";
import { EmptyState, PageHeader, SegmentedTabs } from "@/components/lamp";

const TABS = [
  { key: "roadmaps", label: "Roadmaps" },
  { key: "problems", label: "Problem submissions" },
];

// Decided items leave the queue in the direction of the verdict:
// approvals slide right and glow green, rejections drop left.
const verdictExit = (verdict) => ({
  opacity: 0,
  x: verdict === "reject" ? -60 : 60,
  scale: 0.96,
  height: 0,
  marginTop: 0,
  paddingTop: 0,
  paddingBottom: 0,
  transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
});

const BTN = "inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition disabled:opacity-50 sm:flex-none sm:min-h-[36px]";

export default function AdminModerationPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "roadmaps";

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Admin"
        title="Moderation"
        description="Community submissions waiting for a decision. Authors see your rejection reason."
      >
        <SegmentedTabs
          aria-label="Moderation queue"
          value={tab}
          onChange={(key) => {
            const next = new URLSearchParams(params);
            next.set("tab", key);
            setParams(next, { replace: true });
          }}
          items={TABS.map((t) => ({ value: t.key, label: t.label }))}
        />
      </PageHeader>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          {tab === "roadmaps" && <RoadmapQueue />}
          {tab === "problems" && <ProblemQueue />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────── */

function Meta({ items }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-text-muted">
      {items.filter(Boolean).map((item, i) => (
        <span key={i} className="rounded-full bg-white/[0.04] px-2 py-0.5">{item}</span>
      ))}
    </div>
  );
}

function RoadmapQueue() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [busy,    setBusy]    = useState(new Set());
  const [verdict, setVerdict] = useState("approve");

  const load = useCallback(() => {
    setLoading(true);
    roadmapsApi.queue()
      .then(({ data }) => { setItems(data.data || []); setLoading(false); })
      .catch((err) => { setError(err?.response?.data?.error || "Couldn't load queue"); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const onApprove = useCallback(async (id, feature) => {
    if (busy.has(id)) return;
    setBusy((s) => new Set(s).add(id));
    try {
      await roadmapsApi.approve(id, feature);
      setVerdict("approve");
      setItems((rs) => rs.filter((r) => r.id !== id));
    } catch (err) {
      alert(err?.response?.data?.error || "Approve failed");
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [busy]);

  const onReject = useCallback(async (id) => {
    const reason = prompt("Why is this rejected? (visible to the author)");
    if (!reason) return;
    if (busy.has(id)) return;
    setBusy((s) => new Set(s).add(id));
    try {
      await roadmapsApi.reject(id, reason);
      setVerdict("reject");
      setItems((rs) => rs.filter((r) => r.id !== id));
    } catch (err) {
      alert(err?.response?.data?.error || "Reject failed");
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [busy]);

  if (loading) {
    return <div className="flex min-h-[30vh] items-center justify-center"><Loader variant="orbit" /></div>;
  }

  if (error) {
    return <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</div>;
  }

  return (
    <>
      {items.length === 0 && (
        <EmptyState title="Nothing pending" body="Every roadmap submission has been reviewed. New ones will appear here." />
      )}
      <ul data-stagger="up" className="space-y-3">
        <AnimatePresence initial={false} custom={verdict}>
          {items.map((r) => (
            <motion.li
              key={r.id}
              layout
              custom={verdict}
              variants={{ exit: verdictExit }}
              exit="exit"
              className="lamp-panel overflow-hidden p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-lg text-warning">
                    {r.cover_emoji || <Compass className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-text-primary">{r.title}</p>
                    <p className="mt-1 text-[13px] leading-6 text-text-muted">{r.summary}</p>
                    <Meta items={[
                      r.topic,
                      r.difficulty,
                      r.est_hours ? <span className="lamp-numerals">~{r.est_hours}h</span> : null,
                      r.author ? (
                        <>by {r.author.handle ? (
                          <Link to={`/u/${r.author.handle}`} className="text-primary hover:underline">@{r.author.handle}</Link>
                        ) : (r.author.name || "anon")}</>
                      ) : null,
                    ]} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <Link
                    to={`/roadmaps/${encodeURIComponent(r.slug)}`}
                    target="_blank"
                    className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] text-primary transition hover:bg-primary/10"
                  >
                    Open <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                  <div className="flex flex-wrap gap-1.5">
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      onClick={() => onApprove(r.id, false)}
                      disabled={busy.has(r.id)}
                      className={`${BTN} border-success/40 bg-success/10 text-success hover:bg-success/15`}
                    >
                      <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Approve
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      onClick={() => onApprove(r.id, true)}
                      disabled={busy.has(r.id)}
                      className={`${BTN} border-primary/40 bg-primary/15 text-primary hover:bg-primary/20`}
                    >
                      <Star className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Feature
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      type="button"
                      onClick={() => onReject(r.id)}
                      disabled={busy.has(r.id)}
                      className={`${BTN} border-danger/30 bg-danger/10 text-danger hover:bg-danger/15`}
                    >
                      <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Reject
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}

/* ─────────────────────────────────────────────────────────── */

function ProblemQueue() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [busy,    setBusy]    = useState(new Set());
  const [verdict, setVerdict] = useState("approve");

  const load = useCallback(() => {
    setLoading(true);
    problemSubmissions.queue()
      .then(({ data }) => { setItems(data.data || []); setLoading(false); })
      .catch((err) => { setError(err?.response?.data?.error || "Couldn't load queue"); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const onApprove = useCallback(async (id) => {
    if (busy.has(id)) return;
    setBusy((s) => new Set(s).add(id));
    try {
      await problemSubmissions.approve(id);
      setVerdict("approve");
      setItems((rs) => rs.filter((r) => r.id !== id));
    } catch (err) {
      alert(err?.response?.data?.error || "Approve failed");
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [busy]);

  const onReject = useCallback(async (id) => {
    const reason = prompt("Why is this rejected? (visible to the submitter)");
    if (!reason) return;
    if (busy.has(id)) return;
    setBusy((s) => new Set(s).add(id));
    try {
      await problemSubmissions.reject(id, reason);
      setVerdict("reject");
      setItems((rs) => rs.filter((r) => r.id !== id));
    } catch (err) {
      alert(err?.response?.data?.error || "Reject failed");
    } finally {
      setBusy((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  }, [busy]);

  if (loading) return <div className="flex min-h-[30vh] items-center justify-center"><Loader variant="orbit" /></div>;
  if (error)   return <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</div>;

  return (
    <>
      {items.length === 0 && (
        <EmptyState title="No pending problem submissions" body="Drafts sent in through the AI assistant will queue here for review." />
      )}
      <ul data-stagger="up" className="space-y-3">
        <AnimatePresence initial={false} custom={verdict}>
          {items.map((row) => (
            <motion.li
              key={row.id}
              layout
              custom={verdict}
              variants={{ exit: verdictExit }}
              exit="exit"
              className="lamp-panel overflow-hidden p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary">{row.title}</p>
                  <p className="mt-1 line-clamp-3 text-[13px] leading-6 text-text-muted">{row.description}</p>
                  <Meta items={[
                    row.source,
                    row.difficulty,
                    row.domain,
                    row.submitter ? (
                      <>by {row.submitter.handle ? (
                        <Link to={`/u/${row.submitter.handle}`} className="text-primary hover:underline">@{row.submitter.handle}</Link>
                      ) : (row.submitter.name || "anon")}</>
                    ) : null,
                  ]} />
                  {row.official_url && (
                    <a href={row.official_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1.5 text-[12px] text-primary hover:underline">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span className="truncate">Source: {row.official_url.replace(/^https?:\/\//, "").slice(0, 60)}</span>
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 gap-2 sm:flex-col sm:gap-1.5">
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    type="button"
                    onClick={() => onApprove(row.id)}
                    disabled={busy.has(row.id)}
                    className={`${BTN} border-success/40 bg-success/10 text-success hover:bg-success/15`}
                  >
                    <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Approve
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    type="button"
                    onClick={() => onReject(row.id)}
                    disabled={busy.has(row.id)}
                    className={`${BTN} border-danger/30 bg-danger/10 text-danger hover:bg-danger/15`}
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Reject
                  </motion.button>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}
