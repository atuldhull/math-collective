import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { Check, Lock } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { AsymptoteCurve } from "@/components/lamp";

/**
 * XP + title ladder. The bespoke beat: when the ladder scrolls in, a
 * lamp-coloured spine climbs from the first rung to the viewer's
 * current title, and each rung it passes lights its check as it goes.
 */
export default function XPSidebar({ xp, level, currentTitle, nextTitle, xpTitles, progressToNext }) {
  const ladder = useRef(null);
  const share = Math.max(0, Math.min(progressToNext, 100)) / 100;
  const activeIdx = Math.max(0, xpTitles.findIndex((t) => t.title === currentTitle.title));
  const spine = xpTitles.length > 1 ? activeIdx / (xpTitles.length - 1) : 1;

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: ladder.current, start: "top 80%", once: true },
      });
      tl.fromTo("[data-spine]", { scaleY: 0 }, { scaleY: spine, duration: 0.25 * (activeIdx + 1) + 0.4, ease: "power2.inOut" })
        .from("[data-rung]", { x: -16, autoAlpha: 0, duration: 0.5, stagger: 0.06, ease: "power3.out" }, 0)
        .from("[data-lit]", { scale: 0, duration: 0.4, stagger: 0.25, ease: "back.out(3)" }, 0.2);
    });
    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set("[data-spine]", { scaleY: spine });
    });
    return () => mm.revert();
  }, { scope: ladder, dependencies: [spine, activeIdx], revertOnUpdate: true });

  return (
    <>
      {/* ── XP Card ── */}
      <section data-reveal="right" className="lamp-panel p-5 sm:p-6">
        <p className="text-[13px] font-medium text-text-muted">Experience</p>
        <p className="lamp-numerals mt-2 text-5xl leading-none text-text-primary">
          <AnimatedNumber value={xp} duration={1.6} />
          <span className="ml-2 text-base text-text-dim">XP</span>
        </p>

        <AsymptoteCurve progress={share} className="mt-5 h-16 w-full" />

        <div className="mt-4 flex items-center justify-between text-[13px]">
          <span className="text-text-muted">{currentTitle.title}</span>
          <span className="text-text-primary">
            {nextTitle ? nextTitle.title : "Max Rank"}
          </span>
        </div>
        <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-[linear-gradient(90deg,rgb(var(--violet)),rgb(var(--lamp)))] transition-transform duration-[1400ms] ease-out"
            style={{ transform: `scaleX(${share})` }}
          />
        </div>
        {nextTitle && (
          <p className="mt-2 text-[13px] text-primary">
            {((nextTitle.minXp || 0) - xp).toLocaleString()} XP to{" "}
            <span className="text-text-primary">{nextTitle.title}</span>
          </p>
        )}
      </section>

      {/* ── Title Progression ── */}
      <section ref={ladder} className="lamp-panel p-5 sm:p-6">
        <h3 className="text-lg text-text-primary">Title ladder</h3>
        <p className="mt-1 text-[13px] text-text-muted">Each title unlocks at a fixed amount of XP.</p>

        <ol className="relative mt-5 space-y-1">
          {/* Spine — sits behind the rung markers, climbs to the current title. */}
          <span aria-hidden="true" className="absolute bottom-5 left-[1.375rem] top-5 w-px bg-[rgb(var(--rule))]" />
          <span
            data-spine
            aria-hidden="true"
            className="absolute bottom-5 left-[1.375rem] top-5 w-px origin-top bg-primary shadow-[0_0_8px_rgb(var(--lamp)/0.8)]"
            style={{ transform: `scaleY(${spine})` }}
          />
          {xpTitles.map((t, i) => {
            const isActive = currentTitle.title === t.title;
            const isUnlocked = xp >= t.minXp;

            return (
              <li
                key={t.title}
                data-rung
                className={`relative flex min-h-[48px] items-center gap-3 rounded-xl px-2.5 py-2 ${
                  isActive ? "bg-primary/10 ring-1 ring-primary/30" : ""
                }`}
              >
                <span
                  {...(isUnlocked ? { "data-lit": true } : {})}
                  className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    isActive
                      ? "bg-primary text-[rgb(var(--color-obsidian))]"
                      : isUnlocked
                        ? "bg-surface text-primary ring-1 ring-primary/40"
                        : "bg-surface text-text-dim ring-1 ring-[rgb(var(--rule))]"
                  }`}
                >
                  {isUnlocked ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Lock className="h-3 w-3" strokeWidth={1.75} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${isActive ? "font-medium text-text-primary" : isUnlocked ? "text-text-muted" : "text-text-dim"}`}>
                    {t.title}
                  </p>
                </div>
                <span className="shrink-0 text-[12px] tabular-nums text-text-dim">
                  {(t.minXp ?? 0).toLocaleString()} XP
                </span>
                {isActive && (
                  <span className="shrink-0 text-[12px] font-medium text-primary">
                    Current
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── Quick Stats ── */}
      <section data-reveal="right" className="lamp-panel grid grid-cols-2 divide-x divide-[rgb(var(--rule))] p-5">
        <div className="pr-4">
          <p className="text-[13px] text-text-muted">Level</p>
          <p className="lamp-numerals mt-1 text-3xl text-text-primary">
            <AnimatedNumber value={level} duration={1} />
          </p>
        </div>
        <div className="pl-4">
          <p className="text-[13px] text-text-muted">XP</p>
          <p className="lamp-numerals mt-1 text-3xl text-text-primary">
            <AnimatedNumber value={xp} duration={1.4} />
          </p>
        </div>
      </section>
    </>
  );
}
