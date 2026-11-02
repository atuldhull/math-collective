import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { ExternalLink, Lightbulb, RefreshCw } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { core } from "@/lib/api";
import { useCoreStore } from "@/store/core-store";
import { EmptyState, PageHeader, SegmentedTabs, TiltPanel } from "@/components/lamp";

// Fallback header art per category, drawn from the skin's two inks.
const CAT_GRAD = {
  Maths:          "bg-[linear-gradient(135deg,rgb(var(--violet)/0.38),rgb(var(--violet)/0.06))]",
  Marketing:      "bg-[linear-gradient(135deg,rgb(var(--lamp)/0.38),rgb(var(--lamp)/0.06))]",
  "Social Media": "bg-[linear-gradient(135deg,rgb(var(--violet)/0.28),rgb(var(--lamp)/0.12))]",
  Design:         "bg-[linear-gradient(135deg,rgb(var(--lamp)/0.26),rgb(var(--violet)/0.18))]",
  Technology:     "bg-[linear-gradient(135deg,rgb(var(--color-success)/0.3),rgb(var(--color-success)/0.05))]",
  General:        "bg-[linear-gradient(135deg,rgb(var(--rule)),transparent)]",
};

function timeAgo(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CoreTrendsPage() {
  const { member } = useCoreStore();
  const isCouncil = member?.tier === "council";
  const [data, setData] = useState(null);
  const [category, setCategory] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback((cat) => {
    core.trends(cat && cat !== "All" ? cat : undefined)
      .then((r) => setData(r.data || { trends: [], categories: [] }))
      .catch(() => setData({ trends: [], categories: [] }));
  }, []);

  useEffect(() => { load(category); }, [category, load]);

  const refresh = async () => {
    setRefreshing(true);
    setNote(null);
    try {
      const { data: r } = await core.refreshTrends();
      setNote(r.added ? `Pulled ${r.added} fresh item${r.added > 1 ? "s" : ""}.` : "Already up to date.");
      load(category);
    } catch {
      setNote("Refresh failed — try again later.");
    }
    setRefreshing(false);
    setTimeout(() => setNote(null), 5000);
  };

  // Header images drift against their frames as the card crosses the viewport (scrubbed parallax).
  const root = useRef(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray("[data-parallax]").forEach((img) => {
        gsap.fromTo(img, { yPercent: -9 }, {
          yPercent: 9, ease: "none",
          scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true },
        });
      });
    });
  }, { scope: root, dependencies: [data], revertOnUpdate: true });
  if (!data) {
    return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" label="Loading trends…" /></div>;
  }

  const cats = ["All", ...data.categories];

  return (
    <div ref={root} className="flex flex-col">
      <PageHeader
        context="Core team"
        title="Trends"
        description="Auto-refreshed every 4 hours from maths, marketing, social, design and tech sources — scan for things the club can run with."
        actions={isCouncil ? (
          <Button size="sm" variant="secondary" magnetic={false} loading={refreshing} onClick={refresh} leading={<RefreshCw className="h-4 w-4" strokeWidth={1.75} />}>
            Refresh feed
          </Button>
        ) : null}
      >
        <SegmentedTabs aria-label="Filter trends by category" value={category} onChange={setCategory} items={cats.map((c) => ({ value: c, label: c }))} />
      </PageHeader>

      <AnimatePresence>
        {note && (
          <motion.p key={note} role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[13px] text-primary">{note}</motion.p>
        )}
      </AnimatePresence>

      {data.trends.length === 0 ? (
        <EmptyState title="No trends loaded yet" body="The feed fills up within a few hours of launch." />
      ) : (
        <div data-stagger="tilt" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.trends.map((t) => (
            <TiltPanel
              as="a"
              key={t.id}
              href={t.source_url}
              target="_blank"
              rel="noreferrer noopener"
              className="group flex flex-col overflow-hidden"
            >
              {/* image / gradient header */}
              <div className={`relative h-40 w-full overflow-hidden ${CAT_GRAD[t.category] || CAT_GRAD.General}`}>
                {t.image_url && (
                  <img
                    data-parallax
                    src={t.image_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width="640"
                    height="160"
                    className="absolute inset-x-0 -top-[15%] h-[130%] w-full object-cover opacity-90 transition-[filter] duration-500 group-hover:brightness-110"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                )}
                <span className="absolute left-3 top-3 rounded-full border border-[rgb(var(--rule))] bg-[rgb(var(--color-obsidian)/0.7)] px-2.5 py-0.5 text-[11px] font-medium text-text-primary backdrop-blur">
                  {t.category}
                </span>
              </div>

              {/* body */}
              <div className="relative flex flex-1 flex-col p-4">
                <h3 className="text-base font-medium leading-snug text-text-primary">{t.title}</h3>
                <p className="mt-2 line-clamp-3 flex-1 text-[13px] leading-6 text-text-muted">
                  {t.summary || `Latest from ${t.source_name}. Tap to read the full article.`}
                </p>
                <p className={`mt-3 flex gap-2 rounded-xl border px-3 py-2 text-[13px] leading-6 ${
                  t.club_angle
                    ? "border-primary/25 bg-primary/[0.08] text-primary"
                    : "border-[rgb(var(--rule))] bg-white/[0.03] text-text-muted"
                }`}>
                  <Lightbulb className="mt-1 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span>{t.club_angle || `Could spark a ${t.category.toLowerCase()} reel, post or event — open it for ideas.`}</span>
                </p>
                <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-text-dim">
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate">{t.source_name}<ExternalLink className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden="true" /></span>
                  <span className="lamp-numerals shrink-0">{timeAgo(t.published_at || t.fetched_at)}</span>
                </div>
              </div>
            </TiltPanel>
          ))}
        </div>
      )}
    </div>
  );
}
