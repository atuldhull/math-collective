/**
 * ReferralPage — Referral dashboard with code, stats, QR, leaderboard.
 */

import { useEffect, useState, useMemo, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Link2, Send, UserPlus, Sparkles, Users, Clock3, Zap } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import { PageHeader, TiltPanel, StatTile, EmptyState } from "@/components/lamp";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { referral } from "@/lib/api";

const STEPS = [
  { icon: Send, title: "Share your code", desc: "Copy your unique code or QR and send it to friends." },
  { icon: UserPlus, title: "Friend joins", desc: "They sign up using your code and verify their account." },
  { icon: Sparkles, title: "Both earn XP", desc: "You get 100 XP, they get 50 XP bonus. Everyone wins." },
];

export default function ReferralPage() {
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const root = useRef(null);
  const codeRef = useRef(null);

  useEffect(() => {
    Promise.all([
      referral.getCode().catch(() => ({ data: { code: null } })),
      referral.stats().catch(() => ({ data: null })),
      referral.leaderboard().catch(() => ({ data: [] })),
    ]).then(([codeRes, statsRes, lbRes]) => {
      setStats({ ...statsRes.data, code: statsRes.data?.code || codeRes.data?.code });
      setLeaderboard(Array.isArray(lbRes.data) ? lbRes.data : []);
      setLoading(false);
    });
  }, []);

  const referralLink = useMemo(() => {
    if (!stats?.code) return "";
    return `${window.location.origin}/app/register?ref=${stats.code}`;
  }, [stats?.code]);

  // Generate QR code as data URL using a simple canvas-based approach
  const qrDataUrl = useMemo(() => {
    if (!referralLink) return "";
    // Use a public QR API for simplicity (replace with local lib in production)
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralLink)}&bgcolor=030712&color=B695F8`;
  }, [referralLink]);

  // Bespoke moment: the code's characters arrive like type being set,
  // and every copy sends a wave through them plus a lamp ring.
  const { contextSafe } = useGSAP(() => {
    if (!codeRef.current) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(codeRef.current.querySelectorAll("[data-char]"), {
        yPercent: 110, rotateX: -90, autoAlpha: 0, transformPerspective: 600,
        duration: 0.9, ease: "expo.out", stagger: 0.05, delay: 0.35,
      });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [loading, stats?.code] });

  const playCopied = contextSafe(() => {
    if (!codeRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chars = codeRef.current.querySelectorAll("[data-char]");
    const ring = codeRef.current.querySelector("[data-ring]");
    const tl = gsap.timeline();
    tl.to(chars, { y: -12, color: "rgb(var(--lamp))", duration: 0.22, ease: "power2.out", stagger: { each: 0.035, yoyo: true, repeat: 1 } })
      .set(chars, { clearProps: "color,transform" })
      .fromTo(ring, { scale: 0.85, autoAlpha: 0.9 }, { scale: 1.25, autoAlpha: 0, duration: 0.8, ease: "expo.out" }, 0);
  });

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      playCopied();
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(stats?.code || "").then(() => {
      setCopied(true);
      playCopied();
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader variant="orbit" size="lg" label="Loading referrals..." />
      </div>
    );
  }

  const code = stats?.code || "—";

  return (
    <div ref={root} className="space-y-8 pb-16">
      <PageHeader
        context="Referral programme"
        title="Invite and earn"
        description="Share your code, grow the collective, earn XP."
      />

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <TiltPanel lit data-reveal="up" className="p-6 sm:p-8">
          <p className="relative text-[13px] font-medium text-primary">Your referral code</p>
          <div ref={codeRef} className="relative mt-4 inline-flex">
            <span
              data-ring
              aria-hidden="true"
              className="pointer-events-none absolute -inset-3 rounded-2xl border-2 border-primary opacity-0"
            />
            <p
              aria-label={code}
              className="flex flex-wrap font-mono text-[2.25rem] font-semibold leading-none tracking-[0.12em] text-text-primary [perspective:600px] sm:text-5xl"
            >
              {code.split("").map((ch, i) => (
                <span key={`${ch}-${i}`} data-char aria-hidden="true" className="inline-block">{ch}</span>
              ))}
            </p>
          </div>

          <div className="relative mt-7 flex flex-wrap items-center gap-3">
            <Button size="md" onClick={copyCode} leading={copied ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}>
              {copied ? "Copied" : "Copy code"}
            </Button>
            <Button size="md" variant="secondary" onClick={copyLink} leading={<Link2 className="h-4 w-4" strokeWidth={1.75} />}>
              {copied ? "Copied" : "Copy link"}
            </Button>
            <AnimatePresence>
              {copied ? (
                <motion.span
                  key="copied"
                  role="status"
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                  className="text-sm text-success"
                >
                  On your clipboard
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
          {referralLink ? (
            <p className="relative mt-4 truncate font-mono text-xs text-text-dim">{referralLink}</p>
          ) : null}
        </TiltPanel>

        {qrDataUrl ? (
          <div data-reveal="scale" className="lamp-panel flex flex-col items-center justify-center gap-3 p-6">
            <div className="rounded-2xl border border-[rgb(var(--rule))] bg-obsidian p-3">
              <img src={qrDataUrl} alt="Referral QR Code" loading="lazy" decoding="async" width="160" height="160" className="h-40 w-40 rounded-lg" />
            </div>
            <p className="text-sm text-text-muted">Scan to join</p>
          </div>
        ) : null}
      </section>

      <section data-stagger="up" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile label="Total invites" value={stats?.totalInvites || 0} icon={Users} />
        <StatTile label="Successful" value={stats?.successfulReferrals || 0} icon={Check} tone="good" />
        <StatTile label="Pending" value={stats?.pendingReferrals || 0} icon={Clock3} tone="warn" />
        <StatTile label="XP earned" value={stats?.totalXPEarned || 0} icon={Zap} tone="lamp" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div data-reveal="up" className="lamp-panel p-6">
          <h2 className="text-xl text-text-primary">How it works</h2>
          <ol className="relative mt-5 space-y-5">
            <span aria-hidden="true" className="absolute bottom-4 left-[19px] top-4 w-px bg-[rgb(var(--rule))]" />
            {STEPS.map((item, i) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="relative flex gap-4">
                  <span className="relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--rule))] bg-panel text-primary">
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="pt-1">
                    <h3 className="text-[15px] text-text-primary">
                      <span className="mr-2 text-text-dim">{i + 1}.</span>{item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-text-muted">{item.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div data-reveal="up" className="lamp-panel p-6">
          <h2 className="text-xl text-text-primary">Top referrers</h2>
          {leaderboard.length === 0 ? (
            <EmptyState compact className="mt-4 border-0 bg-transparent" title="No referrals yet" body="Share your code above. The first person to bring a friend in tops this list." />
          ) : (
            <ul data-stagger="left" className="mt-4 space-y-2">
              {leaderboard.map((entry) => (
                <li key={entry.userId} className="flex items-center gap-3 rounded-xl border border-[rgb(var(--rule))] bg-surface/40 px-3 py-2.5 sm:px-4">
                  <span className={cn(
                    "lamp-numerals flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm",
                    entry.rank <= 3 ? "bg-primary/15 text-primary" : "bg-white/[0.05] text-text-dim",
                  )}>
                    {entry.rank}
                  </span>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm text-text-primary"
                    style={{ background: entry.avatar_color || "linear-gradient(135deg, rgb(var(--violet)), rgb(var(--lamp)/0.8))" }}
                  >
                    {entry.avatar_emoji || entry.name?.charAt(0) || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">{entry.name || "User"}</p>
                    <p className="text-xs text-text-dim">{entry.referralCount} referrals</p>
                  </div>
                  <span className="lamp-numerals shrink-0 text-sm text-primary">+{entry.xpEarned} XP</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
