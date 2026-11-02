import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { AlertCircle, Award, CheckCircle2, Download, Eye, FileBadge, Upload, Users, X } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import { certificates } from "@/lib/api";
import { EmptyState, PageHeader, SegmentedTabs } from "@/components/lamp";

const labelCls = "mb-1.5 block text-[13px] font-medium text-text-muted";
const fieldCls =
  "w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-4 py-3 text-sm text-text-primary placeholder-text-dim backdrop-blur outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15";

const PALETTE_OPTIONS = [
  { name: "Royal Purple", value: "purple", colors: ["#8352ff", "#23c1ff"] },
  { name: "Ocean Blue", value: "blue", colors: ["#2563eb", "#06b6d4"] },
  { name: "Emerald", value: "green", colors: ["#059669", "#2dd4bf"] },
  { name: "Sunset Gold", value: "gold", colors: ["#d97706", "#fbbf24"] },
  { name: "Crimson", value: "red", colors: ["#dc2626", "#f87171"] },
];

const CERT_TYPES = [
  { label: "Participation", value: "participation" },
  { label: "Achievement", value: "achievement" },
  { label: "Winner", value: "winner" },
  { label: "Merit", value: "merit" },
];

export default function TeacherCertificatesPage() {
  // Asset upload state
  const [logoFile, setLogoFile] = useState(null);
  const [sigFile, setSigFile] = useState(null);
  const [templateFile, setTemplateFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [sigUrl, setSigUrl] = useState(null);
  // Optional full-bleed background (A4 landscape PNG/JPG). When set,
  // the PDF renderer skips its preset border + fill and uses this
  // image as the whole page — teacher-provided branding passes through.
  const [templateUrl, setTemplateUrl] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

  // Form state
  const [eventName, setEventName] = useState("");
  const [certType, setCertType] = useState("participation");
  const [palette, setPalette] = useState("purple");
  const [recipients, setRecipients] = useState("");
  // Optional free-form achievement paragraph rendered onto the cert.
  // When blank, the PDF renderer falls back to its built-in default verb.
  const [bodyText, setBodyText] = useState("");

  // Match state
  const [matchedStudents, setMatchedStudents] = useState([]);
  const [matching, setMatching] = useState(false);

  // Batch state
  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const logoRef = useRef(null);
  const sigRef = useRef(null);
  const templateRef = useRef(null);
  const sketchRef = useRef(null);

  // Bespoke moment: the miniature certificate turns over on the desk each
  // time the type or palette changes, like a fresh sheet laid on top.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        sketchRef.current.querySelector("[data-sketch]"),
        { rotateY: -14, rotateX: 6, y: 10, scale: 0.97 },
        { rotateY: 0, rotateX: 0, y: 0, scale: 1, duration: 0.9, ease: "elastic.out(1, 0.75)" },
      );
    });
    return () => mm.revert();
  }, { scope: sketchRef, dependencies: [palette, certType] });

  useEffect(() => {
    fetchBatches();
  }, []);

  async function fetchBatches() {
    try {
      setBatchesLoading(true);
      const res = await certificates.batches();
      setBatches(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load batches");
    } finally {
      setBatchesLoading(false);
    }
  }

  async function handleUploadLogo() {
    if (!logoFile) return;
    try {
      setUploadingLogo(true);
      setError(null);
      const res = await certificates.uploadAsset(logoFile, "logo");
      setLogoUrl(res.data?.url || res.data);
      setSuccess("Logo uploaded successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Logo upload failed");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleUploadSig() {
    if (!sigFile) return;
    try {
      setUploadingSig(true);
      setError(null);
      const res = await certificates.uploadAsset(sigFile, "signature");
      setSigUrl(res.data?.url || res.data);
      setSuccess("Signature uploaded successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Signature upload failed");
    } finally {
      setUploadingSig(false);
    }
  }

  async function handleUploadTemplate() {
    if (!templateFile) return;
    try {
      setUploadingTemplate(true);
      setError(null);
      const res = await certificates.uploadAsset(templateFile, "template");
      setTemplateUrl(res.data?.url || res.data);
      setSuccess("Certificate template uploaded successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Template upload failed");
    } finally {
      setUploadingTemplate(false);
    }
  }

  function handleClearTemplate() {
    setTemplateFile(null);
    setTemplateUrl(null);
    if (templateRef.current) templateRef.current.value = "";
  }

  async function handleMatchStudents() {
    if (!recipients.trim()) return;
    try {
      setMatching(true);
      setError(null);
      const res = await certificates.matchStudents(recipients);
      setMatchedStudents(res.data);
      if (res.data.length === 0) {
        setError("No students matched the provided names/emails");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to match students");
    } finally {
      setMatching(false);
    }
  }

  async function handlePreview() {
    try {
      setPreviewing(true);
      setError(null);
      const res = await certificates.preview({
        eventName,
        certType,
        palette,
        recipients,
        logoUrl,
        sigUrl,
        templateUrl,
        bodyText,
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      setError(err.response?.data?.message || "Preview generation failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCreate() {
    if (!eventName.trim()) {
      setError("Event name is required");
      return;
    }
    try {
      setCreating(true);
      setError(null);
      setSuccess(null);
      await certificates.create({
        eventName,
        certType,
        palette,
        recipients,
        logoUrl,
        sigUrl,
        templateUrl,
        bodyText,
      });
      setSuccess("Certificate batch created successfully!");
      setEventName("");
      setRecipients("");
      setBodyText("");
      setMatchedStudents([]);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      fetchBatches();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create certificate batch");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteBatch(id) {
    try {
      setDeletingId(id);
      await certificates.deleteBatch(id);
      setBatches((prev) => prev.filter((b) => b._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete batch");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownloadZip(batchId) {
    try {
      setDownloadingId(batchId);
      const res = await certificates.downloadZip(batchId);
      const blob = new Blob([res.data], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificates-${batchId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  const activePalette = PALETTE_OPTIONS.find((p) => p.value === palette) || PALETTE_OPTIONS[0];
  const activeType = CERT_TYPES.find((ct) => ct.value === certType) || CERT_TYPES[0];
  const recipientLines = recipients.split("\n").map((r) => r.trim()).filter(Boolean);
  const sampleName = matchedStudents[0]?.name || recipientLines[0] || "Recipient name";

  return (
    <div className="space-y-6">
      <PageHeader
        context="Teacher panel"
        title="Certificate generator"
        description="Create and manage certificate batches"
      />

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                {error}
              </span>
              <button onClick={() => setError(null)} aria-label="Dismiss error" className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center text-danger/60 hover:text-danger">
                <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        )}
        {success && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                {success}
              </span>
              <button onClick={() => setSuccess(null)} aria-label="Dismiss notification" className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center text-success/60 hover:text-success">
                <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Certificate form */}
        <section data-reveal="up" className="lamp-panel p-5 sm:p-7 xl:row-span-2">
          <h2 className="text-xl text-text-primary sm:text-2xl">Certificate details</h2>

          <div className="mt-6 space-y-5">
            <div>
              <label htmlFor="cert-event" className={labelCls}>Event name</label>
              <input
                id="cert-event"
                type="text"
                placeholder="e.g. Math Olympiad 2026"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className={fieldCls}
              />
            </div>

            <div>
              <p className={labelCls}>Certificate type</p>
              <SegmentedTabs
                aria-label="Certificate type"
                size="sm"
                items={CERT_TYPES}
                value={certType}
                onChange={setCertType}
              />
            </div>

            <div>
              <p className={labelCls}>Color palette</p>
              <div className="flex flex-wrap gap-2">
                {PALETTE_OPTIONS.map((p) => {
                  const on = palette === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPalette(p.value)}
                      aria-pressed={on}
                      className={`relative flex min-h-[40px] items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                        on ? "border-transparent text-text-primary" : "border-[rgb(var(--rule))] text-text-muted hover:text-text-primary"
                      }`}
                    >
                      {on ? (
                        <motion.span
                          layoutId="palette-ring"
                          className="absolute inset-0 rounded-xl border border-primary/50 bg-primary/10"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      ) : null}
                      <span
                        className="relative h-4 w-4 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})` }}
                      />
                      <span className="relative text-[13px] font-medium">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="cert-recipients" className={labelCls}>Recipients (names or emails, one per line)</label>
              <textarea
                id="cert-recipients"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder={"John Doe\njane@example.com\nAlex Smith"}
                rows={5}
                className={`${fieldCls} resize-y`}
              />
            </div>

            <div>
              <label htmlFor="cert-body" className={labelCls}>Achievement description (optional)</label>
              <textarea
                id="cert-body"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value.slice(0, 4000))}
                placeholder="e.g. For winning the Coding Era hackathon by designing and deploying a real-time collaborative whiteboard."
                rows={3}
                maxLength={4000}
                className={`${fieldCls} resize-y`}
              />
              <p className="mt-1.5 text-[12px] text-text-dim">
                Appears in the body of the certificate. Leave blank for the default phrasing.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-[rgb(var(--rule))] pt-5">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleMatchStudents}
                loading={matching}
                disabled={!recipients.trim()}
                leading={<Users className="h-4 w-4" strokeWidth={1.75} />}
              >
                Match Students
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handlePreview}
                loading={previewing}
                disabled={!eventName.trim()}
                leading={<Eye className="h-4 w-4" strokeWidth={1.75} />}
              >
                Preview
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                loading={creating}
                disabled={!eventName.trim()}
                leading={<Award className="h-4 w-4" strokeWidth={1.75} />}
              >
                Create Batch
              </Button>
            </div>

            <AnimatePresence>
              {matchedStudents.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border border-success/20 bg-success/5 p-4">
                    <p className="text-[13px] font-medium text-success">
                      {matchedStudents.length} students matched
                    </p>
                    <motion.div
                      className="mt-2 flex flex-wrap gap-2"
                      initial="hidden"
                      animate="show"
                      variants={{ show: { transition: { staggerChildren: 0.04 } } }}
                    >
                      {matchedStudents.map((s, i) => (
                        <motion.span
                          key={s._id || i}
                          variants={{ hidden: { opacity: 0, scale: 0.6 }, show: { opacity: 1, scale: 1 } }}
                          className="rounded-full border border-success/25 bg-success/10 px-3 py-1 text-[12px] text-success"
                        >
                          {s.name || s.email}
                        </motion.span>
                      ))}
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        {/* Live miniature — redraws as the form changes */}
        <section data-reveal="left" className="lamp-panel lamp-panel--lit p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl text-text-primary">Sketch</h2>
            <span className="text-[12px] text-text-dim">Updates as you type</span>
          </div>
          <div ref={sketchRef} className="mt-4 [perspective:1200px]">
            <div
              data-sketch
              className="relative aspect-[1.414/1] w-full overflow-hidden rounded-xl p-[3px] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)] transition-[background] duration-700"
              style={{ background: `linear-gradient(135deg, ${activePalette.colors[0]}, ${activePalette.colors[1]})` }}
            >
              <div
                className="relative flex h-full w-full flex-col items-center justify-center rounded-[10px] bg-[#fbfaf6] px-[8%] text-center text-[#1b1830]"
                style={templateUrl ? { backgroundImage: `url(${templateUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="absolute left-[5%] top-[7%] h-[12%] w-auto object-contain" />
                ) : null}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={activeType.value}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-[clamp(9px,1.6vw,13px)] font-medium"
                    style={{ color: activePalette.colors[0] }}
                  >
                    Certificate of {activeType.label.toLowerCase()}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-[3%] text-[clamp(8px,1.2vw,11px)] text-[#6b6880]">presented to</p>
                <p className="lamp-display mt-[1%] max-w-full truncate text-[clamp(16px,3.4vw,30px)] leading-tight">{sampleName}</p>
                <span className="mt-[2%] h-px w-1/2" style={{ background: activePalette.colors[1] }} />
                <p className="mt-[3%] line-clamp-2 max-w-[85%] text-[clamp(8px,1.2vw,11px)] text-[#4a4760]">
                  {bodyText || `for taking part in ${eventName || "your event"}`}
                </p>
                <div className="absolute bottom-[8%] left-[8%] right-[8%] flex items-end justify-between">
                  <div className="flex flex-col items-center">
                    {sigUrl ? <img src={sigUrl} alt="" className="h-[clamp(14px,2.6vw,26px)] w-auto object-contain" /> : <span className="h-[clamp(14px,2.6vw,26px)]" />}
                    <span className="h-px w-[clamp(40px,10vw,90px)] bg-[#1b1830]/40" />
                  </div>
                  <span className="h-[clamp(18px,3.4vw,34px)] w-[clamp(18px,3.4vw,34px)] rounded-[3px] border border-[#1b1830]/30 bg-[repeating-linear-gradient(90deg,#1b1830_0_2px,transparent_2px_4px)] opacity-60" />
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-text-dim">
            A rough sketch of the layout. Use Preview for the real PDF.
          </p>
        </section>

        {/* Upload assets */}
        <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
          <h2 className="text-xl text-text-primary">Logo, signature and template</h2>

          <div className="mt-5 divide-y divide-[rgb(var(--rule))]">
            <AssetRow
              label="Organization logo"
              inputRef={logoRef}
              accept="image/*"
              onFile={setLogoFile}
              onUpload={handleUploadLogo}
              uploading={uploadingLogo}
              disabled={!logoFile}
              done={Boolean(logoUrl)}
              doneText="Logo uploaded"
            />
            <AssetRow
              label="Signature image"
              inputRef={sigRef}
              accept="image/*"
              onFile={setSigFile}
              onUpload={handleUploadSig}
              uploading={uploadingSig}
              disabled={!sigFile}
              done={Boolean(sigUrl)}
              doneText="Signature uploaded"
            />
            <AssetRow
              label="Certificate template (optional)"
              hint="Upload your own A4 landscape PNG or JPG to use as the full background. The recipient name, body, signatories, and QR still render on top — leave the centre of your design clear. When set, the preset border and colours are skipped."
              inputRef={templateRef}
              accept="image/png,image/jpeg"
              onFile={setTemplateFile}
              onUpload={handleUploadTemplate}
              uploading={uploadingTemplate}
              disabled={!templateFile}
            >
              {templateUrl && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-success/25 bg-success/5 px-3 py-1">
                  <p className="text-[12px] text-success">
                    Template active — will be used as the cert background.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearTemplate}
                    className="min-h-[40px] shrink-0 text-[13px] font-medium text-text-muted transition hover:text-danger"
                  >
                    Clear
                  </button>
                </div>
              )}
            </AssetRow>
          </div>
        </section>
      </div>

      {/* Preview display */}
      <AnimatePresence>
        {previewUrl && (
          <motion.section
            initial={{ opacity: 0, y: 40, rotateX: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformPerspective: 1200 }}
            className="lamp-panel p-4 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl text-text-primary">Certificate preview</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
              >
                Close
              </Button>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-[rgb(var(--rule))]">
              <iframe
                src={previewUrl}
                title="Certificate Preview"
                className="h-[60vh] min-h-[360px] w-full bg-white sm:h-[500px]"
              />
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Existing batches */}
      <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl text-text-primary">Existing batches</h2>
          {!batchesLoading && batches.length > 0 ? (
            <span className="text-[13px] tabular-nums text-text-dim">{batches.length} total</span>
          ) : null}
        </div>

        {batchesLoading ? (
          <div className="mt-4 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-[rgb(var(--rule))] bg-surface/30" />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <EmptyState
            compact
            className="mt-4 border-none bg-transparent"
            title="No batches created yet"
            body="Fill in the details above and press Create Batch to issue your first set."
          />
        ) : (
          <ul data-stagger="up" className="mt-4 divide-y divide-[rgb(var(--rule))]">
            <AnimatePresence initial={false}>
              {batches.map((batch) => {
                const id = batch.id || batch._id;
                const created = batch.created_at || batch.createdAt;
                return (
                  <motion.li
                    key={id}
                    layout
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.3 } }}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/12 text-secondary">
                        <FileBadge className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {batch.event_name || batch.eventName || batch.title || "Unnamed Batch"}
                        </p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-text-dim">
                          <span className="capitalize">{batch.cert_type || batch.certType || "certificate"}</span>
                          <span className="tabular-nums">{batch.count ?? batch.recipientCount ?? 0} certificates</span>
                          {created ? <span>{new Date(created).toLocaleDateString()}</span> : null}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-12 sm:pl-0">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownloadZip(id)}
                        loading={downloadingId === id}
                        leading={<Download className="h-4 w-4" strokeWidth={1.75} />}
                      >
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeleteBatch(id)}
                        loading={deletingId === id}
                      >
                        Delete
                      </Button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}

function AssetRow({ label, hint, inputRef, accept, onFile, onUpload, uploading, disabled, done, doneText, children }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <p className="text-[13px] font-medium text-text-muted">{label}</p>
      {hint ? <p className="mt-1 text-[12px] leading-5 text-text-dim">{hint}</p> : null}
      <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          aria-label={label}
          onChange={(e) => onFile(e.target.files[0])}
          className="min-w-0 flex-1 text-[13px] text-text-muted file:mr-3 file:min-h-[40px] file:rounded-xl file:border file:border-[rgb(var(--rule))] file:bg-surface/60 file:px-3 file:py-2 file:text-[13px] file:font-medium file:text-text-muted file:transition hover:file:border-primary/40 hover:file:text-text-primary"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={onUpload}
          loading={uploading}
          disabled={disabled}
          leading={<Upload className="h-4 w-4" strokeWidth={1.75} />}
        >
          Upload
        </Button>
      </div>
      <AnimatePresence>
        {done ? (
          <motion.p
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-2 flex items-center gap-1.5 text-[12px] text-success"
          >
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            {doneText}
          </motion.p>
        ) : null}
      </AnimatePresence>
      {children}
    </div>
  );
}
