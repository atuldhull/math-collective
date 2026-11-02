import { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { Award, BadgeCheck, Download, Medal, ScrollText, Trophy } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import { cn } from "@/lib/cn";
import { PageHeader, TiltPanel, StatTile, EmptyState } from "@/components/lamp";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { certificates } from "@/lib/api";

const TYPES = {
  participation: { label: "Participation", icon: ScrollText, tone: "text-secondary border-secondary/30 bg-secondary/10" },
  winner: { label: "Winner", icon: Trophy, tone: "text-primary border-primary/30 bg-primary/10" },
  merit: { label: "Merit", icon: Medal, tone: "text-warning border-warning/30 bg-warning/10" },
  completion: { label: "Completion", icon: BadgeCheck, tone: "text-success border-success/30 bg-success/10" },
};

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function CertificatesPage() {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const root = useRef(null);

  useEffect(() => {
    fetchCertificates();
  }, []);

  async function fetchCertificates() {
    try {
      setLoading(true);
      setError(null);
      const { data } = await certificates.mine();
      setCerts(data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load certificates");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(cert) {
    try {
      setDownloading(cert._id);
      const response = await certificates.download(cert._id);
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${cert.eventName || "certificate"}-${cert._id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to download certificate");
    } finally {
      setDownloading(null);
    }
  }

  // Bespoke moment: once the documents have flipped in, each seal is
  // pressed onto its paper — a quick spin and squash, like a stamp.
  const { contextSafe } = useGSAP(() => {
    if (!root.current) return undefined;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(gsap.utils.toArray("[data-seal]", root.current), {
        scale: 1.8, rotate: -120, autoAlpha: 0, duration: 0.7, ease: "back.out(2.4)", stagger: 0.09, delay: 0.7,
      });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [loading, certs.length], revertOnUpdate: true });

  // Hover: the document lifts off the desk toward the reader. TiltPanel
  // already leans it toward the pointer; this adds the depth.
  const lift = contextSafe((e) => {
    if (reduceMotion()) return;
    gsap.to(e.currentTarget, { y: -10, z: 40, scale: 1.015, transformPerspective: 1000, duration: 0.5, ease: "power3.out", overwrite: "auto" });
    gsap.to(e.currentTarget.querySelector("[data-shadow]"), { autoAlpha: 1, scale: 1, duration: 0.5, ease: "power3.out" });
  });
  const settle = contextSafe((e) => {
    if (reduceMotion()) return;
    gsap.to(e.currentTarget, { y: 0, z: 0, scale: 1, duration: 0.8, ease: "elastic.out(1, 0.7)", overwrite: "auto" });
    gsap.to(e.currentTarget.querySelector("[data-shadow]"), { autoAlpha: 0, scale: 0.9, duration: 0.5 });
  });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader variant="orbit" size="lg" label="Loading certificates..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-danger">{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchCertificates}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div ref={root} className="space-y-8 pb-16">
      <PageHeader
        context="Achievements"
        title="Your certificates"
        description="Earned through competitions, events, and achievements."
      />

      <section data-stagger="up" className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatTile label="Total earned" value={certs.length} icon={Award} />
        <StatTile label="Winner awards" value={certs.filter((c) => c.type === "winner").length} icon={Trophy} tone="lamp" />
        <StatTile label="Merit awards" value={certs.filter((c) => c.type === "merit").length} icon={Medal} tone="warn" />
      </section>

      {certs.length === 0 ? (
        <EmptyState
          title="No certificates yet"
          body="Take part in an event or competition. Your certificates appear here as soon as they are issued."
        />
      ) : (
        <ul data-stagger="tilt" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 [perspective:1400px]">
          {certs.map((cert, i) => {
            const type = TYPES[cert.type] || TYPES.participation;
            const Icon = type.icon;
            return (
              <li key={cert._id} className="relative">
                <span
                  data-shadow
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-6 -bottom-3 top-8 rounded-[1.25rem] bg-[rgb(var(--lamp)/0.18)] opacity-0 blur-2xl"
                />
                <TiltPanel
                  lit={i === 0}
                  onPointerEnter={lift}
                  onPointerLeave={settle}
                  className="relative h-full p-2.5"
                >
                  {/* The certificate itself: a ruled frame inside the panel. */}
                  <div className="relative flex h-full flex-col rounded-[0.9rem] border border-[rgb(var(--lamp)/0.22)] p-5 [background:repeating-linear-gradient(0deg,transparent_0_23px,rgb(var(--rule)/0.35)_23px_24px)]">
                    <span aria-hidden="true" className="pointer-events-none absolute inset-1.5 rounded-[0.7rem] border border-dashed border-[rgb(var(--rule))]" />
                    <div className="relative flex items-start justify-between gap-3">
                      <span
                        data-seal
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgb(var(--lamp)/0.4)] bg-[radial-gradient(circle_at_35%_30%,rgb(var(--lamp)/0.35),rgb(var(--lamp)/0.06))] text-primary shadow-[0_0_24px_-6px_rgb(var(--lamp)/0.6)]"
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-[12px] font-medium", type.tone)}>
                        {cert.type ? type.label : "Participation"}
                      </span>
                    </div>

                    <p className="relative mt-5 text-[13px] text-text-dim">This certifies achievement in</p>
                    <h3 className="relative mt-1 text-xl leading-snug text-text-primary" style={{ textWrap: "balance" }}>
                      {cert.eventName || cert.title || "Certificate"}
                    </h3>

                    {cert.description && (
                      <p className="relative mt-2 line-clamp-2 text-sm text-text-muted">{cert.description}</p>
                    )}

                    <div className="relative mt-auto flex items-end justify-between gap-3 pt-5">
                      <div className="min-w-0">
                        <span aria-hidden="true" className="block h-px w-24 bg-[rgb(var(--rule))]" />
                        {cert.issuedAt && (
                          <span className="mt-1.5 block text-xs text-text-dim">
                            Issued{" "}
                            {new Date(cert.issuedAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      <Button
                        variant={i === 0 ? "primary" : "secondary"}
                        size="sm"
                        loading={downloading === cert._id}
                        onClick={() => handleDownload(cert)}
                        leading={<Download className="h-4 w-4" strokeWidth={1.75} />}
                      >
                        Download
                      </Button>
                    </div>
                  </div>
                </TiltPanel>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
