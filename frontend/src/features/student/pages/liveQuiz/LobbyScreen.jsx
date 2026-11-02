import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { LogOut, Wifi } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import LiveStage from "./LiveStage";

export default function LobbyScreen({ sessionCode, lobbyPlayers, lobbyCount, onLeave }) {
  const root = useRef(null);

  // Bespoke moment: a sonar sweeps out from the session code while the
  // room waits for the host, and the code's letters flip into place.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.from(q("[data-char]"), {
        rotateX: -100, y: 20, autoAlpha: 0, transformPerspective: 500, duration: 0.8, ease: "back.out(2)", stagger: 0.06, delay: 0.2,
      });
      q("[data-sonar]").forEach((ring, i) => {
        gsap.fromTo(ring, { scale: 0.35, autoAlpha: 0.8 }, {
          scale: 1.6, autoAlpha: 0, duration: 3, ease: "power1.out", repeat: -1, delay: i * 1,
        });
      });
    });
    return () => mm.revert();
  }, { scope: root });

  return (
    <LiveStage tone="violet" center>
      <div ref={root} className="w-full max-w-2xl">
        <div className="lamp-panel lamp-panel--lit relative overflow-hidden p-6 sm:p-10">
          <div className="relative text-center">
            <p className="inline-flex items-center gap-2 text-[13px] font-medium text-success">
              <Wifi className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Connected
            </p>
            <h2 className="lamp-display mt-3 text-3xl text-text-primary sm:text-4xl">
              Waiting for the host
            </h2>
            <p className="mt-2 text-sm text-text-muted">The quiz will begin shortly...</p>

            {/* Session code with a sonar sweeping out behind it */}
            <div className="relative mx-auto mt-8 flex h-40 items-center justify-center sm:h-48">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  data-sonar
                  aria-hidden="true"
                  className="absolute h-40 w-40 rounded-full border border-[rgb(var(--violet)/0.5)] opacity-0 sm:h-48 sm:w-48"
                />
              ))}
              <div className="relative rounded-2xl border border-[rgb(var(--rule))] bg-obsidian/80 px-5 py-4 backdrop-blur">
                <p className="text-[13px] text-text-dim">Session</p>
                <p aria-label={sessionCode} className="mt-1 flex justify-center font-mono text-3xl font-semibold tracking-[0.2em] text-primary sm:text-4xl">
                  {String(sessionCode).split("").map((ch, i) => (
                    <span key={`${ch}-${i}`} data-char aria-hidden="true" className="inline-block">{ch}</span>
                  ))}
                </p>
              </div>
            </div>
          </div>

          {/* Player list */}
          <div className="relative mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-base text-text-primary">Players in the lobby</h3>
              <span className="relative inline-flex h-8 min-w-[2rem] items-center justify-center overflow-hidden rounded-full border border-secondary/30 bg-secondary/10 px-3 text-sm text-secondary">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={lobbyCount}
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -16, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="lamp-numerals"
                  >
                    {lobbyCount}
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {lobbyPlayers.map((name, i) => (
                  <motion.div
                    key={name + i}
                    layout
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ type: "spring", stiffness: 420, damping: 22, delay: Math.min(i, 12) * 0.04 }}
                    className="flex min-w-0 items-center gap-2 rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-3 py-2"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgb(var(--violet)),rgb(var(--lamp)/0.9))] text-xs font-semibold text-[rgb(var(--color-obsidian))]">
                      {name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate text-sm font-medium text-text-primary">
                      {name}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="relative mt-8 text-center">
            <Button variant="ghost" size="sm" onClick={onLeave} leading={<LogOut className="h-4 w-4" strokeWidth={1.75} />}>
              Leave session
            </Button>
          </div>
        </div>
      </div>
    </LiveStage>
  );
}
