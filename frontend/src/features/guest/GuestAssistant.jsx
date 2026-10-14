import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// The bot API requires a signed-in user. This guest panel preserves that
// boundary while the original member assistant remains untouched.
export default function GuestAssistant() {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef(null),
    panelRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const close = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    const outside = (event) => {
      if (!panelRef.current?.contains(event.target) && !launcherRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return (
    <>
      {open && (
        <section ref={panelRef} tabIndex={-1} className="mc-guest-chat" role="dialog" aria-labelledby="mc-chat-title">
          <div className="mc-chat-heading">
            <span aria-hidden="true">✳</span>
            <h2 id="mc-chat-title">Meet PANDA.</h2>
            <button
              aria-label="Close PANDA"
              onClick={() => {
                setOpen(false);
                launcherRef.current?.focus();
              }}
            >
              ×
            </button>
          </div>
          <p>
            Your mathematical thinking partner. Explore a concept, work through a problem, or find a new way to look at
            it.
          </p>
          <div className="mc-chat-topics">
            <span>Calculus</span>
            <span>Algebra</span>
            <span>Probability</span>
          </div>
          <p className="mc-chat-note">Sign in to start a conversation.</p>
          <Link to="/login" onClick={() => setOpen(false)}>
            Sign in to chat <span aria-hidden="true">↗</span>
          </Link>
        </section>
      )}
      <button
        ref={launcherRef}
        className="mc-guest-assistant"
        aria-label="Toggle PANDA AI"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">{open ? "×" : "✳"}</span> {open ? "Close" : "Ask PANDA"}
      </button>
    </>
  );
}
