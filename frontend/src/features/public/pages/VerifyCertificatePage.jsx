/**
 * Public certificate verification page.
 *
 * Lives at /verify?token=UUID and talks to /api/certificates/verify/:token.
 * Anyone (no login) can hit this — it's the target a QR code on a
 * Asymptotes certificate points to. A potential employer or
 * admissions officer scans the QR, lands here, and immediately sees
 * whether the cert is legitimate + who it was issued to.
 *
 * Never displays the recipient's email — we don't want this page
 * to become a phishing aid.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { Check, X } from "lucide-react";
import axios from "axios";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import Button from "@/components/ui/Button";
import { PageHeader, WorldIntro, useIsGuest } from "@/components/lamp";

const motionOK = () =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

const ledgerBeats = [
  { kicker: "Certificate verification", title: "Is this certificate genuine?", body: "Every certificate Asymptotes issues is written to a ledger. This page checks yours against it." },
  { kicker: "No sign-in needed", title: "One scan, one answer", body: "Scroll on to see who it was issued to, and for what." },
];

const ledgerGlyphs = ["✓", "§", "ID", "∎", "QED", "#", "✕", "?", "∴", "≡"];

export default function VerifyCertificatePage() {
  const isGuest = useIsGuest();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    if (!token) {
      setState({ loading: false, data: null, error: "No verification token supplied." });
      return;
    }
    axios
      .get(`/api/certificates/verify/${encodeURIComponent(token)}`)
      .then((res) => setState({ loading: false, data: res.data, error: null }))
      .catch((err) => {
        const reason = err?.response?.data?.reason || "Could not reach the verification service.";
        setState({ loading: false, data: null, error: reason });
      });
  }, [token]);

  return (
    <>
      {isGuest ? (
        <WorldIntro
          beats={ledgerBeats}
          glyphs={ledgerGlyphs}
          length={2.6}
          inset="full"
          cta={<Link to="/register"><Button size="lg">Join the collective</Button></Link>}
        />
      ) : (
        <PageHeader
          context="Certificate verification"
          title="Is this certificate genuine?"
          description="Anyone with this page can confirm a certificate is genuine. We never ask you to log in for verification."
          size="sm"
        />
      )}

      <div className="mx-auto w-full max-w-2xl pb-16">
        <section className="lamp-panel lamp-panel--lit p-5 sm:p-8" aria-live="polite">
          {state.loading && (
            <div className="flex items-center gap-3 py-6">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
              <p className="text-sm text-text-muted">Checking ledger…</p>
            </div>
          )}

          {!state.loading && state.data?.valid && (
            <VerifiedCard data={state.data} />
          )}

          {!state.loading && !state.data?.valid && (
            <InvalidCard reason={state.error || state.data?.reason || "Certificate not recognised."} />
          )}
        </section>

        <p data-reveal="fade" className="mt-6 text-center text-[13px] text-text-dim">
          Cross-reference at{" "}
          <a href="https://math-collective.onrender.com" className="text-secondary underline-offset-4 hover:underline">
            math-collective.onrender.com
          </a>
        </p>
      </div>
    </>
  );
}

/**
 * Seal — an ink stamp that slams onto the panel. It drops from above,
 * oversized and rotated, hits with a jolt that shakes its panel, leaves
 * an ink splash ring, then its rim of lettering turns slowly.
 */
function Seal({ tone, children, label }) {
  const isGood = tone === "good";
  const color = isGood ? "rgb(var(--lamp))" : "rgb(var(--color-danger))";
  const ring = (isGood ? "Asymptotes · verified · genuine · " : "Asymptotes · not found · void · ").repeat(2);
  return (
    <div data-seal-wrap className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32" role="img" aria-label={label}>
      <span data-splash aria-hidden="true" className="absolute inset-0 rounded-full opacity-0" style={{ boxShadow: `0 0 0 2px ${color}` }} />
      <div data-seal className="absolute inset-0" style={{ transform: "rotate(-8deg)" }}>
        <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <path id={`seal-rim-${tone}`} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
          </defs>
          <circle cx="60" cy="60" r="56" fill="none" stroke={color} strokeWidth="2.5" opacity="0.9" />
          <circle cx="60" cy="60" r="34" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3 4" opacity="0.7" />
          <g data-rim style={{ transformOrigin: "60px 60px" }}>
            <text fill={color} fontSize="9.2" fontWeight="600" letterSpacing="1.4" opacity="0.9">
              <textPath href={`#seal-rim-${tone}`}>{ring}</textPath>
            </text>
          </g>
        </svg>
        <span className="absolute inset-0 grid place-items-center" style={{ color }}>
          {children}
        </span>
      </div>
    </div>
  );
}

function useStamp(scope) {
  useGSAP(() => {
    if (!motionOK()) return;
    const q = gsap.utils.selector(scope);
    const tl = gsap.timeline({ delay: 0.15 });
    tl.fromTo(q("[data-seal]"),
      { scale: 2.6, rotate: -32, autoAlpha: 0, filter: "blur(6px)" },
      { scale: 1, rotate: -8, autoAlpha: 1, filter: "blur(0px)", duration: 0.5, ease: "power4.in" })
      .fromTo(q("[data-splash]"), { scale: 0.85, autoAlpha: 0.8 }, { scale: 1.7, autoAlpha: 0, duration: 0.9, ease: "expo.out" }, ">-0.02")
      .fromTo(scope.current, { x: 0 }, { keyframes: { x: [-7, 6, -4, 3, -1, 0] }, duration: 0.42, ease: "none" }, "<")
      .from(q("[data-verdict] > *"), { y: 18, autoAlpha: 0, duration: 0.7, stagger: 0.08, ease: "expo.out" }, "<0.1")
      .from(q("[data-detail] > *"), { y: 14, autoAlpha: 0, duration: 0.6, stagger: 0.06, ease: "expo.out" }, "<0.2");
    gsap.to(q("[data-rim]"), { rotate: 360, duration: 40, ease: "none", repeat: -1 });
  }, { scope });
}

function VerifiedCard({ data }) {
  const root = useRef(null);
  useStamp(root);
  const dateStr = data.eventDate
    ? new Date(data.eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const issuedStr = data.issuedAt
    ? new Date(data.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  return (
    <div ref={root}>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
        <Seal tone="good" label="Verified seal">
          <Check className="h-10 w-10 sm:h-12 sm:w-12" strokeWidth={2.25} aria-hidden="true" />
        </Seal>
        <div data-verdict>
          <p className="text-[13px] font-medium text-success">Verified certificate</p>
          <p className="lamp-display mt-1 text-2xl text-text-primary sm:text-3xl">This certificate is genuine</p>
          <p className="mt-2 text-sm text-text-muted">Issued to {data.recipientName}.</p>
        </div>
      </div>

      <dl data-detail className="mt-7 space-y-3 border-t border-[rgb(var(--rule))] pt-6">
        <Row label="Recipient"      value={data.recipientName} strong />
        <Row label="Event"          value={data.eventName} />
        {dateStr  && <Row label="Event date"  value={dateStr} />}
        <Row label="Issued by"      value={data.issuedBy || "Asymptotes"} />
        {issuedStr && <Row label="Issued on"   value={issuedStr} />}
        {data.signatory && <Row label="Signed by" value={`${data.signatory.name}${data.signatory.title ? `, ${data.signatory.title}` : ""}`} />}
        <Row label="Certificate ID" value={data.certificateId} mono />
      </dl>

      <p className="mt-6 rounded-xl border border-success/20 bg-success/5 px-4 py-2.5 text-[13px] text-success">
        Verified against the Asymptotes certificate ledger on {new Date().toLocaleString()}
      </p>
    </div>
  );
}

function InvalidCard({ reason }) {
  const root = useRef(null);
  useStamp(root);
  return (
    <div ref={root}>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
        <Seal tone="bad" label="Not verified seal">
          <X className="h-10 w-10 sm:h-12 sm:w-12" strokeWidth={2.25} aria-hidden="true" />
        </Seal>
        <div data-verdict>
          <p className="text-[13px] font-medium text-danger">Cannot verify</p>
          <p className="lamp-display mt-1 text-2xl text-text-primary sm:text-3xl">Certificate not found</p>
        </div>
      </div>
      <div data-detail className="mt-7 border-t border-[rgb(var(--rule))] pt-6">
        <p className="text-sm leading-6 text-text-muted">
          This token does not correspond to a certificate we issued. Possible
          reasons:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-muted">
          <li>The link was mistyped or truncated.</li>
          <li>The certificate was revoked by its issuer.</li>
          <li>The certificate was never issued by Asymptotes.</li>
        </ul>
        <p className="mt-4 text-[13px] text-text-dim">
          Server response: <span className="font-mono text-text-muted">{reason}</span>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, strong, mono }) {
  // Stack label above value on mobile so long values (cert IDs, dates,
  // full names) don't get squeezed against a fixed 128px label column.
  // At sm+ we go back to the side-by-side layout that reads as a
  // proper definition list.
  return (
    <div className="flex flex-col gap-1 border-b border-[rgb(var(--rule))] pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-[13px] font-medium text-text-dim sm:w-32 sm:shrink-0">
        {label}
      </dt>
      <dd className={cn("flex-1", mono ? "break-all font-mono text-[13px]" : "break-words", strong ? "font-semibold text-text-primary" : "text-text-muted")}>
        {value}
      </dd>
    </div>
  );
}
