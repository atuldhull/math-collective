import { useEffect, useState } from "react";
import PandaBot from "@/components/panda/PandaBot";
import InteractiveCursor from "@/components/experience/InteractiveCursor";
import LoadingScreen from "@/components/experience/LoadingScreen";
import HovercardRoot from "@/components/social/HovercardRoot";
import ChatButton from "@/components/chat/ChatButton";
import IdentityModalsRoot from "@/components/identity/IdentityModalsRoot";
import ScrollProgressBar from "@/components/experience/ScrollProgressBar";
import AmbientCursorGlow from "@/components/experience/AmbientCursorGlow";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { useScrollEffects } from "@/hooks/useScrollEffects";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";

export default function ExperienceShell({ children }) {
  const reducedMotion = useReducedMotionPreference();
  const [booting, setBooting] = useState(true);

  useSmoothScroll(!reducedMotion);
  useScrollEffects(!reducedMotion && !booting);

  useEffect(() => {
    if (reducedMotion) {
      setBooting(false);
      return undefined;
    }

    // Was a flat 1500ms on EVERY full page load, tied to nothing that
    // was actually loading — a second and a half of forced waiting
    // before the site appeared. Hand control to the browser instead:
    // hide as soon as the page has finished loading, with a short
    // floor so the animation does not flash, and a ceiling so a slow
    // asset cannot trap anyone behind it.
    const MIN_MS = 300;
    const MAX_MS = 1500;
    const startedAt = performance.now();

    let timeoutId = 0;
    const finish = () => {
      const elapsed = performance.now() - startedAt;
      const wait = Math.max(0, MIN_MS - elapsed);
      timeoutId = window.setTimeout(() => setBooting(false), wait);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish, { once: true });
      // Safety net: never hold the screen longer than the old timeout.
      timeoutId = window.setTimeout(() => setBooting(false), MAX_MS);
    }

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("load", finish);
    };
  }, [reducedMotion]);

  return (
    <>
      <LoadingScreen visible={booting} />
      <ScrollProgressBar />
      <AmbientCursorGlow />
      <InteractiveCursor enabled={!reducedMotion} />
      {children}
      <PandaBot />
      {/* Floating messages button for any logged-in user. Hidden when
          guest/loading — the auth gate lives inside ChatButton itself.
          Opens the slide-out chat panel which handles conversations
          list, friend search, and pending requests. */}
      <ChatButton />
      {/* Single-portal hovercard — listens to hovercard-store and
          renders the currently-shown card anchored via portal. Zero
          cost when no card is open (returns null). */}
      <HovercardRoot />
      {/* Identity ceremony + restore modals. Only shows to users
          who've opened chat but haven't forged their identity yet. */}
      <IdentityModalsRoot />
    </>
  );
}
