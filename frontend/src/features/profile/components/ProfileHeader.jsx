/**
 * ProfileHeader — top section of the rich profile page.
 *
 * Responsibilities:
 *   - Big avatar + name + role/title/xp block
 *   - Action button row (FriendButton + MessageButton), self-hidden
 *   - "Private profile" branch when the payload carries isPrivate:true
 *
 * This component trusts the shape returned by /api/users/:id/profile
 * (already privacy-gated server-side). `isSelf` gates the
 * self-only affordances (the "Edit profile" link, email visibility).
 *
 * Lamplight: this is the page's opening beat and its one lit panel.
 * The avatar swings in on its hinge, the name rises out of its
 * baseline, the asymptote draws, and the stat strip settles.
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { Lock, Pencil } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { AsymptoteCurve } from "@/components/lamp";
import FriendButton from "@/components/social/FriendButton";
import MessageButton from "@/components/social/MessageButton";
import IdentityGlyph from "@/components/identity/IdentityGlyph";
import CoreBadge from "@/features/coreTeam/components/CoreBadge";

/**
 * @param {{
 *   profile: any,                      // from GET /api/users/:id/profile
 *   access: { isSelf: boolean, reason: string, canViewProfile: boolean },
 *   userId: string,
 * }} props
 */
export default function ProfileHeader({ profile, access, userId, coreBadge }) {
  const root = useRef(null);

  useGSAP(() => {
    if (!root.current) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.timeline({ defaults: { ease: "expo.out" } })
        .from("[data-avatar]", { rotateY: -70, scale: 0.7, autoAlpha: 0, transformPerspective: 800, duration: 1.1 })
        .from("[data-name]", { yPercent: 110, duration: 1, }, 0.12)
        .from("[data-meta] > *", { y: 10, autoAlpha: 0, duration: 0.6, stagger: 0.06 }, 0.3)
        .from("[data-stat]", { y: 22, autoAlpha: 0, duration: 0.8, stagger: 0.09 }, 0.45)
        .from("[data-actions] > *", { x: 16, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, 0.5);
    });
    return () => mm.revert();
  }, { scope: root });

  if (!profile) return null;
  const isPrivate = profile.isPrivate === true;

  return (
    <section ref={root} className="lamp-panel lamp-panel--lit relative overflow-hidden p-5 sm:p-8">
      {!isPrivate && (
        <AsymptoteCurve
          tone="violet"
          className="pointer-events-none absolute -right-4 top-6 hidden h-20 w-72 opacity-70 md:block"
        />
      )}
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Avatar — big, with optional colored background */}
        <div
          data-avatar
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.4rem] text-5xl sm:h-28 sm:w-28 sm:text-6xl"
          style={{
            backgroundColor: profile.avatar_color || "rgba(255,255,255,0.06)",
            boxShadow: "0 0 0 1px rgb(var(--lamp)/0.35), 0 18px 44px -16px rgb(var(--lamp)/0.6)",
          }}
          aria-hidden
        >
          {profile.avatar_emoji || "👤"}
        </div>

        {/* Name + role + stats */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* Identity glyph — the unique math-sigil derived from this
                user's public key. Same user → same glyph, everywhere
                on the platform. Changes iff they regenerate keys. */}
            {!isPrivate && userId && (
              <IdentityGlyph userId={userId} size={36} title="Identity glyph" />
            )}
            <h1 className="lamp-display overflow-hidden pb-1 text-[2rem] leading-tight text-text-primary sm:text-[2.6rem]">
              <span data-name className="inline-block">{profile.name || "Unknown user"}</span>
            </h1>
          </div>

          <div data-meta className="mt-2 flex flex-wrap items-center gap-2">
            {isPrivate ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--rule))] px-2.5 py-1 text-[12px] text-text-dim">
                <Lock className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                <span>Private</span>
              </span>
            ) : (
              profile.role && (
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[12px] font-medium capitalize text-primary">
                  {profile.role}
                </span>
              )
            )}
            {/* Core-team tag — Council / Head / Core. */}
            {!isPrivate && coreBadge?.isCoreMember && (
              <CoreBadge tier={coreBadge.tier} />
            )}
            {!isPrivate && profile.title && (
              <span className="rounded-full border border-secondary/30 bg-secondary/12 px-2.5 py-1 text-[12px] text-secondary">
                {profile.title}
              </span>
            )}
          </div>

          {!isPrivate && coreBadge?.isCoreMember && (
            <p className="mt-2 text-[13px] text-text-muted">
              {coreBadge.position}{coreBadge.team ? `, ${coreBadge.team}` : ""}, Club Asymptotes
            </p>
          )}

          {/* Self-only: email exposed in a muted line.
              Non-self viewers NEVER see this because the backend
              only serialises email for access.isSelf. */}
          {access.isSelf && profile.email && (
            <p className="mt-2 break-all text-[13px] text-text-dim">
              {profile.email}
            </p>
          )}

          {/* Stats strip */}
          {!isPrivate && (
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4 border-t border-[rgb(var(--rule))] pt-5">
              {typeof profile.xp === "number" && (
                <div data-stat>
                  <p className="lamp-numerals text-3xl leading-none text-primary">{profile.xp}</p>
                  <p className="mt-1 text-[13px] text-text-muted">Total XP</p>
                </div>
              )}
              {typeof profile.friend_count === "number" && (
                <div data-stat>
                  <p className="lamp-numerals text-3xl leading-none text-text-primary">{profile.friend_count}</p>
                  <p className="mt-1 text-[13px] text-text-muted">
                    {profile.friend_count === 1 ? "Friend" : "Friends"}
                  </p>
                </div>
              )}
              {typeof profile.achievement_count === "number" && (
                <div data-stat>
                  <p className="lamp-numerals text-3xl leading-none text-text-primary">{profile.achievement_count}</p>
                  <p className="mt-1 text-[13px] text-text-muted">
                    {profile.achievement_count === 1 ? "Badge" : "Badges"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Bio — only on public + non-self (self edits it elsewhere) */}
          {!isPrivate && profile.bio && (
            <p className="mt-5 max-w-[62ch] whitespace-pre-wrap text-[15px] leading-7 text-text-muted">
              {profile.bio}
            </p>
          )}
        </div>

        {/* Action buttons (right side on desktop, wraps under on mobile) */}
        <div data-actions className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-end">
          {access.isSelf ? (
            <Link
              to="/profile"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-3.5 text-[13px] font-medium text-text-primary transition hover:border-primary/45 hover:bg-primary/[0.06]"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Edit profile
            </Link>
          ) : (
            <>
              <FriendButton userId={userId} size="sm" />
              <MessageButton userId={userId} size="sm" />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
