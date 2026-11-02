import { Component } from "react";
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { useIsLamplight } from "@/components/lamp/SkinProvider";
import AsymptoteCurve from "@/components/lamp/AsymptoteCurve";

/**
 * RouteErrorBoundary — catches render errors inside a specific route
 * so a single broken page shows a contained error UI while the
 * surrounding app (navigation, layout, theme) stays intact.
 *
 * Distinct from components/ErrorBoundary.jsx which is the APP-LEVEL
 * boundary with a full-screen fallback used as the final backstop.
 * That one is the "something went wrong" page you end up on when
 * even the router itself blew up. This one sits inside the router,
 * underneath Suspense, and only affects the route outlet.
 *
 * Caveats:
 *   - Only catches errors thrown during RENDER, lifecycle methods,
 *     or constructors. Async throws inside event handlers or
 *     useEffect callbacks still bubble past React; those need
 *     handler-level try/catch or the global unhandled-rejection
 *     listener (which pino already logs at fatal via config/crash.js).
 *   - Reset behaviour: clicking "Try again" clears the internal
 *     flag. That re-mounts the children with fresh state, so a
 *     transient bug (failed fetch, stale data) often recovers.
 *     If the bug is deterministic, the same error will re-throw and
 *     the user sees the boundary again — which is the right thing.
 */
export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Route boundary — log but don't crash the whole app. Matches the
    // console contract of the app-level boundary for consistency;
    // future work could wire this through the pino logger via a
    // `/api/client-errors` endpoint.
    console.error("[RouteErrorBoundary] Caught:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <SkinnedFallback error={this.state.error} onReset={this.reset}>
        {this.renderLegacy()}
      </SkinnedFallback>
    );
  }

  renderLegacy() {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-line/10 bg-white/[0.02] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-danger/20 bg-danger/10">
            <svg
              className="h-7 w-7 text-danger"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-white">This page hit a snag</h2>
          <p className="mt-2 text-sm text-white/50">
            The rest of the app is still working — try again, or head elsewhere
            using the navigation.
          </p>

          {this.state.error?.message && (
            <div className="mt-4 rounded-lg border border-line/10 bg-black/20 px-3 py-2">
              <p className="truncate font-mono text-xs text-white/40">
                {this.state.error.message}
              </p>
            </div>
          )}

          <button
            onClick={this.reset}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-primary/40 bg-gradient-to-r from-primary via-secondary to-glow px-5 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-white shadow-orbit transition hover:-translate-y-0.5"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
}

/**
 * Picks the fallback for the current skin. Class components can't call
 * hooks, so the skin check lives in this small function component; the
 * legacy markup arrives pre-rendered as children.
 */
function SkinnedFallback({ error, onReset, children }) {
  const lamp = useIsLamplight();
  if (!lamp) return children;
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-1 py-10 sm:px-4">
      <motion.div
        role="alert"
        initial={{ opacity: 0, y: 18, rotateX: 10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
        style={{ transformPerspective: 900 }}
        className="lamp-panel w-full max-w-md p-7 text-center sm:p-9"
      >
        {/* The curve stalls short of the line: the page never arrived. */}
        <AsymptoteCurve progress={0.55} tone="violet" className="mx-auto h-12 w-40" />
        <h2 className="lamp-display mt-6 text-2xl text-text-primary">This page hit a snag</h2>
        <p className="mx-auto mt-2 max-w-[38ch] text-sm leading-6 text-text-muted">
          The rest of the app is still working — try again, or head elsewhere
          using the navigation.
        </p>

        {error?.message && (
          <div className="mt-5 rounded-xl border border-[rgb(var(--rule))] bg-[rgb(var(--color-obsidian)/0.5)] px-3.5 py-2.5 text-left">
            <p className="truncate font-mono text-[12px] text-text-dim">{error.message}</p>
          </div>
        )}

        <button
          type="button"
          onClick={onReset}
          className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-[rgb(var(--color-obsidian))] shadow-[0_10px_30px_-12px_rgb(var(--lamp)/0.75)] transition hover:brightness-110 active:scale-[0.97]"
        >
          <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Try again
        </button>
      </motion.div>
    </div>
  );
}
