import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { Check, Minus, ShieldCheck } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import { PageHeader, TiltPanel } from "@/components/lamp";
import { useAuthStore } from "@/store/auth-store";

// The features a student can see, and which plans unlock them. Same
// rules the page always used — just evaluated for every tier so the
// student can see where their organisation sits on the ladder.
const FEATURES = [
  { name: "Arena challenges", test: () => true },
  { name: "Leaderboard", test: () => true },
  { name: "Events", test: () => true },
  { name: "Live quiz", test: (p) => p !== "free" },
  { name: "Certificates", test: (p) => p !== "free" },
  { name: "AI question generation", test: (p) => p === "professional" || p === "enterprise" },
  { name: "Projects", test: (p) => p !== "free" },
  { name: "Advanced analytics", test: (p) => p === "professional" || p === "enterprise" },
];

const TIERS = [
  { id: "free", label: "Free", blurb: "The essentials for a new club." },
  { id: "starter", label: "Starter", blurb: "Live quizzes, certificates and projects." },
  { id: "professional", label: "Professional", blurb: "Adds AI questions and deeper analytics." },
  { id: "enterprise", label: "Enterprise", blurb: "Everything, for whole institutions." },
];

export default function BillingPage() {
  const user = useAuthStore((s) => s.user);
  const plan = user?.org_plan || "free";
  const orgName = user?.org_name || "Your Organisation";
  const root = useRef(null);

  const included = FEATURES.filter((f) => f.test(plan)).length;
  const knownTier = TIERS.some((t) => t.id === plan);

  // Bespoke moment: the current plan's feature ticks stamp in one by one
  // after the ladder settles, and its lamp breathes once.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ delay: 0.5, defaults: { ease: "back.out(2.2)" } });
      tl.from(q("[data-tick]"), { scale: 0, rotate: -40, duration: 0.5, stagger: 0.06 })
        .fromTo(q("[data-meter]"), { scaleX: 0 }, { scaleX: 1, transformOrigin: "left center", duration: 1.1, ease: "expo.out" }, 0)
        .fromTo(q("[data-current]"), { boxShadow: "0 0 0 0 rgb(var(--lamp)/0)" },
          { boxShadow: "0 0 60px -10px rgb(var(--lamp)/0.55)", duration: 0.9, yoyo: true, repeat: 1, ease: "sine.inOut", clearProps: "boxShadow" }, 0.6);
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <div ref={root} className="space-y-8 pb-16">
      <PageHeader
        context={orgName}
        title="Your plan"
        description={plan === "free"
          ? "You're on the free plan. Contact your organisation admin to upgrade."
          : `Your organisation is on the ${plan} plan. All features included in your plan are active.`}
        progress={included / FEATURES.length}
      />

      <section aria-label="Current plan" className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <TiltPanel data-reveal="up" className="p-6 sm:p-8">
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-medium text-primary">Active for {orgName}</p>
              <p className="lamp-display mt-2 text-5xl capitalize text-text-primary sm:text-6xl">{plan}</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-primary" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="relative mt-6">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-text-muted">Features unlocked</span>
              <span className="lamp-numerals text-text-primary">{included} of {FEATURES.length}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgb(var(--rule))]">
              <div data-meter className="h-full rounded-full bg-primary" style={{ width: `${(included / FEATURES.length) * 100}%` }} />
            </div>
          </div>
        </TiltPanel>

        <div data-reveal="up" className="lamp-panel p-6 sm:p-8">
          <h2 className="text-lg text-text-primary">What's included</h2>
          <ul className="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {FEATURES.map((f) => {
              const on = f.test(plan);
              return (
                <li key={f.name} className="flex items-center gap-3 rounded-lg py-1.5">
                  <span
                    data-tick={on ? "" : undefined}
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      on ? "bg-success/15 text-success" : "bg-white/[0.04] text-text-dim",
                    )}
                  >
                    {on ? <Check className="h-3.5 w-3.5" strokeWidth={2.25} aria-label="Included" /> : <Minus className="h-3.5 w-3.5" strokeWidth={2} aria-label="Not included" />}
                  </span>
                  <span className={cn("text-sm", on ? "text-text-primary" : "text-text-dim line-through")}>{f.name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-label="Plans">
        <h2 data-reveal="fade" className="mb-4 text-xl text-text-primary">How the plans compare</h2>
        <div data-stagger="tilt" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((tier) => {
            const current = tier.id === plan;
            const count = FEATURES.filter((f) => f.test(tier.id)).length;
            return (
              <div
                key={tier.id}
                data-current={current ? "" : undefined}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "lamp-panel relative flex flex-col p-5 transition-transform duration-500 hover:-translate-y-1",
                  current && "lamp-panel--lit",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="lamp-display text-xl text-text-primary">{tier.label}</p>
                  {current ? (
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-medium text-[rgb(var(--color-obsidian))]">Your plan</span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-text-muted">{tier.blurb}</p>
                <p className="mt-auto pt-5 text-[13px] text-text-dim">
                  <span className="lamp-numerals text-2xl text-text-primary">{count}</span> of {FEATURES.length} features
                </p>
              </div>
            );
          })}
        </div>
        {!knownTier ? (
          <p className="mt-3 text-sm text-text-dim">Your organisation is on a custom plan.</p>
        ) : null}
      </section>

      <div data-reveal="fade" className="lamp-panel p-5 sm:p-6">
        <p className="text-sm leading-6 text-text-muted">
          Need to upgrade? Contact your <span className="text-text-primary">organisation admin</span>. They manage billing and subscriptions through the Admin panel.
        </p>
      </div>
    </div>
  );
}
