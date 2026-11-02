/**
 * EventScannerPage — QR scanner for teachers/admins at events.
 *
 * Flow:
 *   1. Select event from dropdown
 *   2. Camera opens with QR scanner
 *   3. Scan student's QR → POST /events/:id/scan-qr
 *   4. Show result (success with student name + XP, or error)
 *   5. Auto-reset for next scan after 3 seconds
 *
 * Edge cases:
 *   - Invalid QR (not mc-event format) → "Invalid QR code"
 *   - Wrong event QR → "No registration found for this event"
 *   - Already checked in → "Already checked in" + student name
 *   - Cancelled registration → "Registration was cancelled"
 *   - Camera denied → Fallback to manual token input
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { AlertTriangle, Camera, CheckCircle2, ChevronDown, Keyboard, QrCode, ScanLine, Square, XCircle } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { EmptyState, PageHeader } from "@/components/lamp";
import { events as eventsApi } from "@/lib/api";

export default function EventScannerPage() {
  const rootRef = useRef(null);
  const viewportRef = useRef(null);

  const [eventsList, setEventsList] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { type, message, student }
  const [manualToken, setManualToken] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const scannerRef = useRef(null);
  const resultTimerRef = useRef(null);

  // Fetch events
  useEffect(() => {
    eventsApi.list()
      .then(r => setEventsList(Array.isArray(r.data) ? r.data.filter(e => e.status === "active" || e.status === "registering") : []))
      .catch(() => setEventsList([]))
      .finally(() => setLoading(false));
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear();
        scannerRef.current = null;
      }
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  // Process scanned QR data
  const processQr = useCallback(async (qrData) => {
    if (!selectedEventId) return;

    // Parse QR: "mc-event:{eventId}:{qr_token}"
    const parts = qrData.split(":");
    if (parts.length !== 3 || parts[0] !== "mc-event") {
      setScanResult({ type: "error", message: "Invalid QR — not a Asymptotes event QR" });
      autoReset();
      return;
    }

    const [, qrEventId, qrToken] = parts;

    // Check if QR is for the selected event
    if (qrEventId !== selectedEventId) {
      setScanResult({ type: "error", message: "This QR is for a different event" });
      autoReset();
      return;
    }

    // Call API
    try {
      const { data } = await eventsApi.scanQr(selectedEventId, qrToken);
      setScanResult({
        type: "success",
        message: `${data.student?.name || "Student"} checked in${data.xp_awarded ? ` — +${data.xp_awarded} XP` : ""}`,
        student: data.student,
      });
      setScanCount(c => c + 1);
    } catch (err) {
      const errData = err.response?.data;
      setScanResult({
        type: errData?.student ? "warning" : "error",
        message: errData?.error || "Scan failed",
        student: errData?.student,
      });
    }

    autoReset();
  }, [selectedEventId]);

  const autoReset = () => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    resultTimerRef.current = setTimeout(() => setScanResult(null), 3500);
  };

  // Start camera scanner
  const startScanner = async () => {
    if (!selectedEventId) return;
    setScanResult(null);
    setScanning(true);

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Pause scanning while processing
          scanner.pause(true);
          processQr(decodedText).finally(() => {
            // Resume after result display
            setTimeout(() => {
              try { scanner.resume(); } catch { /* ignore if stopped */ }
            }, 2000);
          });
        },
        () => { /* ignore scan failures — just means no QR in frame yet */ }
      );
    } catch (err) {
      console.error("[Scanner]", err);
      setScanning(false);
      setShowManual(true);
      setScanResult({ type: "error", message: "Camera access denied. Use manual entry below." });
    }
  };

  // Stop scanner
  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  // Manual token submit
  const handleManualSubmit = async () => {
    if (!manualToken.trim() || !selectedEventId) return;
    // Construct QR data and process
    await processQr(`mc-event:${selectedEventId}:${manualToken.trim()}`);
    setManualToken("");
  };

  // Bespoke moment: while the camera is live a lamp line sweeps the frame
  // top to bottom and the corner brackets breathe; a result freezes both.
  useGSAP(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const sweep = vp.querySelector("[data-sweep]");
    const corners = vp.querySelectorAll("[data-corner]");
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      if (sweep) {
        gsap.fromTo(sweep, { top: "4%" }, { top: "96%", duration: 1.8, ease: "sine.inOut", repeat: -1, yoyo: true });
      }
      if (scanning && !scanResult) {
        gsap.to(corners, { scale: 1.12, duration: 1.1, ease: "sine.inOut", repeat: -1, yoyo: true, stagger: 0.12 });
      } else if (scanResult) {
        gsap.fromTo(corners, { scale: 1.3 }, { scale: 1, duration: 0.6, ease: "back.out(3)" });
      }
    });
    mm.add("(prefers-reduced-motion: reduce)", () => {
      if (sweep) gsap.set(sweep, { top: "50%" });
    });
    return () => mm.revert();
  }, { scope: viewportRef, dependencies: [scanning, scanResult, selectedEventId], revertOnUpdate: true });

  const tone = scanResult?.type === "success" ? "success" : scanResult?.type === "warning" ? "warning" : "danger";
  const toneText = { success: "text-success", warning: "text-warning", danger: "text-danger" }[tone];
  const toneBox = {
    success: "border-success/35 bg-success/10",
    warning: "border-warning/35 bg-warning/10",
    danger: "border-danger/35 bg-danger/10",
  }[tone];
  const selectedEvent = eventsList.find((ev) => String(ev.id) === String(selectedEventId));

  const header = (
    <PageHeader
      context="Teacher panel"
      title="QR scanner"
      description="Scan student QR codes for check-in"
      size="sm"
    />
  );

  if (loading) {
    return (
      <div>
        {header}
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader variant="orbit" size="lg" label="Loading events..." />
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="pb-6">
      {header}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Event selector + tally: on phones this comes first, so the scanner sits under your thumb */}
        <aside className="space-y-4 lg:order-2">
          <section data-reveal="up" className="lamp-panel p-5">
            <label htmlFor="scan-event" className="mb-2 block text-[13px] font-medium text-text-muted">Select Event</label>
            <div className="relative">
              <select
                id="scan-event"
                value={selectedEventId}
                onChange={(e) => { setSelectedEventId(e.target.value); stopScanner(); setScanResult(null); setScanCount(0); }}
                className="w-full appearance-none rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-4 py-3 pr-10 text-sm text-text-primary outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              >
                <option value="">— Choose an event —</option>
                {eventsList.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.title} — {ev.status}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
            </div>
            {eventsList.length === 0 ? (
              <p className="mt-3 text-[13px] text-text-dim">No events are open for check-in. Set an event to active or registering first.</p>
            ) : null}
          </section>

          {selectedEventId && (
            <section data-reveal="up" className="lamp-panel flex items-center justify-between gap-4 p-5">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-text-muted">Checked in this session</p>
                <p className="mt-1 truncate text-[12px] text-text-dim">{selectedEvent?.title}</p>
              </div>
              <motion.p
                key={scanCount}
                initial={{ scale: scanCount ? 1.35 : 1 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="lamp-numerals text-4xl leading-none text-success"
                aria-live="polite"
              >
                <AnimatedNumber value={scanCount} duration={0.6} />
                <span className="sr-only"> checked in</span>
              </motion.p>
            </section>
          )}
        </aside>

        {/* Scanner */}
        {selectedEventId ? (
          <section data-reveal="up" className="lamp-panel lamp-panel--lit p-4 sm:p-6 lg:order-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ScanLine className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
                <h2 className="text-lg text-text-primary sm:text-xl">Camera scanner</h2>
              </div>
              {!scanning ? (
                <Button size="sm" onClick={startScanner} leading={<Camera className="h-4 w-4" strokeWidth={1.75} />}>Start Scanner</Button>
              ) : (
                <Button size="sm" variant="danger" onClick={stopScanner} leading={<Square className="h-3.5 w-3.5" strokeWidth={1.75} />}>Stop</Button>
              )}
            </div>

            {/* Camera viewport — html5-qrcode mounts into #qr-reader; the frame is a pointer-free overlay */}
            <div
              ref={viewportRef}
              className={`relative mt-4 overflow-hidden rounded-2xl border bg-black transition-colors duration-300 ${
                scanResult ? toneBox.split(" ")[0] : "border-[rgb(var(--rule))]"
              }`}
            >
              <div
                id="qr-reader"
                style={{ width: "100%", minHeight: scanning ? 300 : 0, transition: "min-height 0.3s" }}
              />
              {!scanning && (
                <div className="flex h-56 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-text-dim sm:h-64">
                  <QrCode className="h-10 w-10 text-text-dim/60" strokeWidth={1.25} aria-hidden="true" />
                  Click "Start Scanner" to open camera
                </div>
              )}

              {/* Scan frame: four lamp brackets that breathe, and a lamp line that sweeps while the camera is live */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div data-frame className="relative aspect-square w-[min(68%,260px)]">
                  {["left-0 top-0 border-l-2 border-t-2 rounded-tl-xl", "right-0 top-0 border-r-2 border-t-2 rounded-tr-xl", "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl", "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl"].map((pos) => (
                    <span
                      key={pos}
                      data-corner
                      className={`absolute h-9 w-9 transition-colors duration-300 ${pos} ${
                        scanResult ? `border-current ${toneText}` : scanning ? "border-primary" : "border-text-dim/40"
                      }`}
                    />
                  ))}
                  {scanning && !scanResult ? (
                    <span
                      data-sweep
                      className="absolute inset-x-2 top-0 h-[2px] rounded-full bg-primary shadow-[0_0_18px_4px_rgb(var(--lamp)/0.55)]"
                    >
                      <span className="absolute inset-x-0 top-0 h-10 -translate-y-full bg-[linear-gradient(0deg,rgb(var(--lamp)/0.22),transparent)]" />
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Result stamp over the viewport */}
              <AnimatePresence>
                {scanResult && (
                  <motion.div
                    key={scanResult.message}
                    aria-hidden="true"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
                  >
                    <motion.span
                      className={`absolute h-28 w-28 rounded-full border-2 border-current ${toneText}`}
                      initial={{ scale: 0.6, opacity: 0.9 }}
                      animate={{ scale: 2.6, opacity: 0 }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                    />
                    <motion.svg
                      viewBox="0 0 52 52"
                      className={`h-24 w-24 ${toneText}`}
                      initial={{ scale: 0.5, rotate: tone === "danger" ? -20 : 0 }}
                      animate={tone === "danger"
                        ? { scale: 1, rotate: 0, x: [0, -10, 10, -6, 6, 0] }
                        : { scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 16, x: { duration: 0.5, delay: 0.2 } }}
                    >
                      <motion.circle
                        cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                      {tone === "success" ? (
                        <motion.path
                          d="M15 27 l7 7 l15 -16" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.35, ease: "easeOut" }}
                        />
                      ) : tone === "warning" ? (
                        <>
                          <motion.path d="M26 14 v15" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
                            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.35 }} />
                          <motion.circle cx="26" cy="37" r="2.2" fill="currentColor"
                            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6 }} />
                        </>
                      ) : (
                        <motion.path
                          d="M18 18 L34 34 M34 18 L18 34" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
                          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.3 }}
                        />
                      )}
                    </motion.svg>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Scan result feedback */}
            <AnimatePresence>
              {scanResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  role="status"
                  className={`mt-4 overflow-hidden rounded-xl border px-4 py-3 ${toneBox}`}
                >
                  <div className="flex items-center gap-3">
                    {tone === "success" ? (
                      <CheckCircle2 className={`h-6 w-6 shrink-0 ${toneText}`} strokeWidth={1.75} aria-hidden="true" />
                    ) : tone === "warning" ? (
                      <AlertTriangle className={`h-6 w-6 shrink-0 ${toneText}`} strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <XCircle className={`h-6 w-6 shrink-0 ${toneText}`} strokeWidth={1.75} aria-hidden="true" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${toneText}`}>
                        {scanResult.message}
                      </p>
                      {scanResult.student && (
                        <p className="mt-0.5 break-words text-[13px] text-text-dim">
                          {scanResult.student.name}
                          {scanResult.student.email ? <span className="ml-2 text-text-dim/80">{scanResult.student.email}</span> : null}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Manual fallback */}
            <div className="mt-5 border-t border-[rgb(var(--rule))] pt-4">
              <button
                onClick={() => setShowManual(!showManual)}
                aria-expanded={showManual}
                className="flex min-h-[40px] w-full items-center justify-between text-left"
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-text-muted">
                  <Keyboard className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Manual entry (fallback)
                </span>
                <motion.span animate={{ rotate: showManual ? 180 : 0 }} className="text-text-dim">
                  <ChevronDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </motion.span>
              </button>
              <AnimatePresence>
                {showManual && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="mb-2 mt-2 text-[13px] text-text-dim">Enter the student's QR token manually (32-character hex code)</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        aria-label="QR token"
                        placeholder="QR token (e.g. a1b2c3d4...)"
                        value={manualToken}
                        onChange={e => setManualToken(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleManualSubmit()}
                        className="min-w-0 flex-1 rounded-xl border border-[rgb(var(--rule))] bg-black/20 px-3 py-2.5 font-mono text-sm text-text-primary outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                      />
                      <Button size="sm" onClick={handleManualSubmit} disabled={!manualToken.trim()}>
                        Check In
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        ) : (
          <div className="lg:order-1">
            <EmptyState
              title="Pick an event to start scanning"
              body="Choose the event you're checking students into. The camera opens once an event is selected."
            />
          </div>
        )}
      </div>
    </div>
  );
}
