/**
 * AvatarCreator — Realistic avatar builder using DiceBear + custom options.
 *
 * Tabs:
 *   1. STYLE — Pick an art style (Adventurer, Avataaars, Big Ears, Lorelei, Notionists, etc)
 *   2. CUSTOMIZE — Tweak face features for the chosen style
 *   3. EMOJI — Quick emoji picker (40 options)
 *   4. PHOTO — Upload your own image
 *
 * Uses @dicebear/core + @dicebear/collection for client-side SVG avatar generation.
 * All customization saves to Supabase via avatar_config JSONB field.
 */

import { useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Dices, ImagePlus, Palette, SlidersHorizontal, Smile } from "lucide-react";
import { useIsLamplight } from "@/components/lamp/SkinProvider";

const LAMP_TAB_ICON = { style: Palette, customize: SlidersHorizontal, emoji: Smile, upload: Camera };
import { createAvatar } from "@dicebear/core";
// Named imports of ONLY the 8 styles actually used. The previous
// `import * as avatarStyles from "@dicebear/collection"` was a
// namespace import — rollup can't tree-shake those because runtime
// code could in theory access any key dynamically, so the bundler
// has to include every ~30 style at build time (each with its own
// SVG sprite logic). Switching to explicit named imports lets
// tree-shaking drop the unused styles — significantly lighter
// profile chunk, verified in the build output.
import {
  adventurer,
  avataaars,
  bigEars,
  lorelei,
  notionists,
  openPeeps,
  personas,
  micah,
} from "@dicebear/collection";

// ═══════════════════════════════════════════════════════════
// AVAILABLE STYLES
// ═══════════════════════════════════════════════════════════

const STYLES = [
  { key: "adventurer", label: "Explorer", icon: "🧭", style: adventurer },
  { key: "avataaars",  label: "Classic",  icon: "👤", style: avataaars },
  { key: "bigEars",    label: "Big Ears", icon: "👂", style: bigEars },
  { key: "lorelei",    label: "Lorelei",  icon: "🎨", style: lorelei },
  { key: "notionists", label: "Notion",   icon: "✏️", style: notionists },
  { key: "openPeeps",  label: "Peeps",    icon: "🫂", style: openPeeps },
  { key: "personas",   label: "Persona",  icon: "🎭", style: personas },
  { key: "micah",      label: "Micah",    icon: "🌈", style: micah },
];

// ═══════════════════════════════════════════════════════════
// CUSTOMIZATION OPTIONS per style
// ═══════════════════════════════════════════════════════════

const SKIN_COLORS = [
  "#FDDBB4", "#F1C27D", "#E0AC69", "#C68642", "#8D5524", "#5C3310",
];

const HAIR_COLORS = [
  "#090806", "#2C222B", "#71635A", "#B7A69E", "#D6C4C2",
  "#CABFAD", "#DA680F", "#B55239", "#A8171A", "#4E0101",
  "#5E1B6D", "#0C4A6E", "#065F46",
];

const BG_COLORS = [
  "transparent",
  "#7c3aed", "#3b82f6", "#10b981", "#f43f5e", "#f59e0b",
  "#06b6d4", "#8b5cf6", "#d946ef", "#84cc16", "#f97316",
  "#00FFC8", "#FF2D78", "#D4A017", "#FF6B35", "#00CFFF",
];

// Seed words that generate interesting consistent faces
const SEED_PRESETS = [
  "math-wizard", "quantum-mind", "euler-fan", "gauss-geek", "pi-lover",
  "infinity-seeker", "prime-hunter", "set-theory", "calculus-pro", "algebra-ace",
  "tensor-flow", "eigen-value", "fourier-fan", "laplace-dream", "riemann-surf",
  "hilbert-space", "mandelbrot", "fibonacci", "pythagoras", "archimedes",
  "newton-apple", "leibniz-dx", "cantor-set", "godel-proof", "turing-halt",
  "nash-equilib", "ramanujan", "noether-ring", "hypatia", "lovelace",
];

// ═══════════════════════════════════════════════════════════
// EMOJI FACES (quick option)
// ═══════════════════════════════════════════════════════════

const EMOJI_FACES = [
  "😎", "🤓", "🧐", "😏", "🤩", "😇", "🥳", "😤",
  "🤔", "😮", "🫡", "🤗", "😶‍🌫️", "🥶", "🔥", "💀",
  "👻", "🤖", "👽", "🦊", "🐼", "🦁", "🐸", "🦉",
  "🐺", "🦄", "🐲", "🎭", "🧙", "🧑‍🚀", "🧑‍💻", "🧑‍🔬",
  "🧑‍🎓", "🧑‍🏫", "🦸", "🥷", "👑", "💎", "⚡", "🌟",
];

// ═══════════════════════════════════════════════════════════
// GRADIENT BACKGROUNDS
// ═══════════════════════════════════════════════════════════

const GRADIENTS = [
  "linear-gradient(135deg, #7c3aed, #3b82f6)",
  "linear-gradient(135deg, #f43f5e, #ec4899)",
  "linear-gradient(135deg, #10b981, #06b6d4)",
  "linear-gradient(135deg, #f59e0b, #ef4444)",
  "linear-gradient(135deg, #8b5cf6, #d946ef)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #84cc16, #22c55e)",
  "linear-gradient(135deg, #f97316, #fbbf24)",
  "linear-gradient(135deg, #1a1a2e, #16213e)",
  "linear-gradient(135deg, #D4A017, #8B6914)",
  "linear-gradient(135deg, #00FFC8, #0088AA)",
  "linear-gradient(135deg, #FF2D78, #7B4FE0)",
  "linear-gradient(135deg, #FF6B35, #FF2200)",
  "linear-gradient(135deg, #00CFFF, #B695F8)",
  "linear-gradient(135deg, #0f0c29, #302b63)",
  "linear-gradient(135deg, #2ECC71, #1abc9c)",
];

// ═══════════════════════════════════════════════════════════
// AVATAR SVG GENERATOR
// ═══════════════════════════════════════════════════════════

function generateAvatarSVG(styleKey, seed, options = {}) {
  const styleObj = STYLES.find((s) => s.key === styleKey);
  if (!styleObj) return "";

  try {
    const avatar = createAvatar(styleObj.style, {
      seed: seed,
      size: 256,
      backgroundColor: options.bgColor && options.bgColor !== "transparent"
        ? [options.bgColor.replace("#", "")]
        : ["transparent"],
      ...(options.skinColor ? { skinColor: [options.skinColor.replace("#", "")] } : {}),
      ...(options.hairColor ? { hairColor: [options.hairColor.replace("#", "")] } : {}),
      ...options.extra,
    });

    return avatar.toDataUri();
  } catch {
    return "";
  }
}

// ═══════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════

const TABS = [
  { key: "style", label: "Style", icon: "🎨" },
  { key: "customize", label: "Customize", icon: "⚙️" },
  { key: "emoji", label: "Emoji", icon: "😎" },
  { key: "upload", label: "Photo", icon: "📸" },
];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function AvatarCreator({
  currentEmoji = "😎",
  currentColor = "linear-gradient(135deg, #7c3aed, #3b82f6)",
  currentConfig = null,
  avatarUrl = null,
  onEmojiSelect,
  onColorSelect,
  onConfigChange,
  onPhotoUpload,
  uploading = false,
}) {
  const [tab, setTab] = useState("style");
  const lamp = useIsLamplight();
  const t = (a, b) => (lamp ? a : b);
  // Lamplight: each randomize spins the preview a full turn on its Y axis.
  const [spin, setSpin] = useState(0);
  const ringSel = t("ring-2 ring-primary ring-offset-2 ring-offset-[rgb(var(--color-surface))]", ringSel);
  const chipOn = t("bg-[rgb(var(--lamp)/0.16)] text-primary ring-1 ring-[rgb(var(--lamp)/0.4)]", "bg-primary/20 text-white");
  const chipOff = t("bg-surface/60 text-text-muted ring-1 ring-[rgb(var(--rule))] hover:text-text-primary", "bg-white/[0.03] text-text-dim hover:text-white");
  const chipBase = t("rounded-full px-3 py-1.5 font-mono text-[11px] transition", "rounded-full px-2.5 py-1 font-mono text-[9px] transition");
  const label = t("mb-2 text-[13px] font-medium text-text-muted", "mb-2 font-mono text-[10px] uppercase tracking-wider text-text-dim");
  /** Sentence-case the legacy Title Case labels in Lamplight. */
  const L = (text) => (lamp ? text.charAt(0) + text.slice(1).toLowerCase() : text);
  const fileRef = useRef(null);

  // Avatar builder state
  const [styleKey, setStyleKey] = useState(currentConfig?.styleKey || "adventurer");
  const [seed, setSeed] = useState(currentConfig?.seed || "math-wizard");
  const [skinColor, setSkinColor] = useState(currentConfig?.skinColor || "");
  const [hairColor, setHairColor] = useState(currentConfig?.hairColor || "");
  const [bgColor, setBgColor] = useState(currentConfig?.bgColor || "transparent");
  const [avatarMode, setAvatarMode] = useState(currentConfig?.type || "dicebear"); // 'dicebear' | 'emoji' | 'photo'

  // Generate avatar SVG data URI
  const avatarDataUri = useMemo(
    () => generateAvatarSVG(styleKey, seed, { skinColor, hairColor, bgColor }),
    [styleKey, seed, skinColor, hairColor, bgColor],
  );

  // Save config to backend whenever it changes
  const saveConfig = useCallback(
    (overrides = {}) => {
      const config = {
        type: "dicebear",
        styleKey,
        seed,
        skinColor,
        hairColor,
        bgColor,
        ...overrides,
      };
      onConfigChange?.(config);
    },
    [styleKey, seed, skinColor, hairColor, bgColor, onConfigChange],
  );

  // Randomize seed
  const randomize = () => {
    const newSeed = SEED_PRESETS[Math.floor(Math.random() * SEED_PRESETS.length)] + "-" + Date.now();
    setSeed(newSeed);
    saveConfig({ seed: newSeed });
    setSpin((v) => v + 360);
  };

  // Determine what to show in preview
  const previewContent = useMemo(() => {
    if (avatarMode === "photo" && avatarUrl) {
      // 144px = h-36 w-36 (the parent container's fixed dimensions);
      // explicit width/height attrs let the browser reserve the layout
      // box before the image arrives → no CLS while the preview swaps.
      return <img src={avatarUrl} alt="Avatar" loading="lazy" decoding="async" width="144" height="144" className="h-full w-full rounded-full object-cover" />;
    }
    if (avatarMode === "emoji") {
      return <span style={{ fontSize: "4rem", lineHeight: 1 }}>{currentEmoji}</span>;
    }
    if (avatarDataUri) {
      return <img src={avatarDataUri} alt="Avatar" loading="lazy" decoding="async" width="144" height="144" className="h-full w-full rounded-full object-cover" />;
    }
    return <span style={{ fontSize: "4rem", lineHeight: 1 }}>{currentEmoji}</span>;
  }, [avatarMode, avatarUrl, avatarDataUri, currentEmoji]);

  return (
    <div className="space-y-4">
      {/* ── Live Preview ── */}
      <div className="flex flex-col items-center gap-3">
        <motion.div
          layout
          animate={lamp ? { rotateY: spin } : undefined}
          transition={lamp ? { type: "spring", stiffness: 90, damping: 14 } : undefined}
          className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full"
          style={{
            background: avatarMode === "dicebear" && bgColor === "transparent" ? currentColor : (bgColor !== "transparent" ? bgColor : currentColor),
            border: lamp ? "2px solid rgb(var(--lamp) / 0.55)" : "3px solid var(--monument-sky)",
            boxShadow: lamp ? "0 0 0 6px rgb(var(--lamp) / 0.08), 0 20px 50px -20px rgb(var(--lamp) / 0.6)" : "0 0 30px rgba(182,149,248,0.3)",
            transformPerspective: lamp ? 700 : undefined,
          }}
        >
          {previewContent}
        </motion.div>
        {lamp ? (
          <button
            onClick={randomize}
            className="group flex h-10 items-center gap-2 rounded-xl border border-[rgb(var(--rule))] bg-surface/60 px-3.5 text-[13px] font-medium text-text-muted transition hover:border-[rgb(var(--lamp)/0.45)] hover:text-text-primary"
          >
            <Dices className="h-4 w-4 text-primary transition-transform duration-500 group-hover:rotate-[200deg]" strokeWidth={1.75} aria-hidden="true" />
            Randomize
          </button>
        ) : (
        <button
          onClick={randomize}
          className="flex items-center gap-1.5 rounded-full border border-line/20 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-muted transition hover:border-primary/30 hover:text-white"
        >
          <span>🎲</span> Randomize
        </button>
        )}
      </div>

      {/* ── Tab Bar ── */}
      <div role={lamp ? "tablist" : undefined} className={t("grid grid-cols-4 gap-1 rounded-xl border border-[rgb(var(--rule))] bg-[rgb(var(--color-obsidian)/0.4)] p-1", "flex justify-center gap-1 rounded-xl bg-white/[0.03] p-1")}>
        {lamp ? TABS.map((tb) => {
          const Icon = LAMP_TAB_ICON[tb.key];
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(tb.key);
                if (tb.key === "emoji") setAvatarMode("emoji");
                else if (tb.key === "upload") setAvatarMode("photo");
                else setAvatarMode("dicebear");
              }}
              className={`relative flex h-10 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors ${active ? "text-text-primary" : "text-text-dim hover:text-text-muted"}`}
            >
              {active && (
                <motion.span
                  layoutId="avatar-tab-slider"
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                  className="absolute inset-0 rounded-lg border border-[rgb(var(--lamp)/0.35)] bg-[rgb(var(--lamp)/0.12)]"
                />
              )}
              <Icon className={`relative h-4 w-4 ${active ? "text-primary" : ""}`} strokeWidth={1.75} aria-hidden="true" />
              <span className="relative hidden sm:inline">{tb.label}</span>
            </button>
          );
        }) : TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              if (t.key === "emoji") setAvatarMode("emoji");
              else if (t.key === "upload") setAvatarMode("photo");
              else setAvatarMode("dicebear");
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition ${
              tab === t.key ? "bg-primary/15 text-white" : "text-text-dim hover:text-white"
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {/* ──── STYLE TAB ──── */}
          {tab === "style" && (
            <div className="space-y-4">
              <p className={t("text-center text-[13px] text-text-muted", "text-center text-xs text-text-dim")}>Choose your avatar art style</p>

              {/* Style grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STYLES.map((s) => {
                  const preview = generateAvatarSVG(s.key, seed, { skinColor, hairColor });
                  return (
                    <button
                      key={s.key}
                      onClick={() => {
                        setStyleKey(s.key);
                        setAvatarMode("dicebear");
                        saveConfig({ styleKey: s.key });
                      }}
                      className={lamp
                        ? `flex flex-col items-center gap-2 rounded-2xl p-3 transition hover:-translate-y-0.5 ${styleKey === s.key ? "bg-[rgb(var(--lamp)/0.1)] ring-1 ring-[rgb(var(--lamp)/0.45)]" : "bg-surface/50 ring-1 ring-[rgb(var(--rule))] hover:ring-[rgb(var(--lamp)/0.3)]"}`
                        : `flex flex-col items-center gap-2 rounded-xl p-3 transition hover:bg-white/5 ${
                        styleKey === s.key ? "bg-primary/15 ring-1 ring-primary/40" : "bg-white/[0.02]"
                      }`}
                    >
                      <div className="h-14 w-14 overflow-hidden rounded-full bg-black/20">
                        {preview && <img src={preview} alt={s.label} loading="lazy" decoding="async" width="56" height="56" className="h-full w-full object-cover" />}
                      </div>
                      <div className="text-center">
                        <span className={t("block text-[13px] font-medium text-text-primary", "block text-[10px] text-white")}>{s.label}</span>
                        {!lamp && <span className="block text-[9px] text-text-dim">{s.icon}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Seed presets (quick face changes) */}
              <div>
                <p className={label}>{L("Quick Faces")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {SEED_PRESETS.slice(0, 15).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSeed(s);
                        saveConfig({ seed: s });
                      }}
                      className={`${chipBase} ${
                        seed === s ? chipOn : chipOff
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ──── CUSTOMIZE TAB ──── */}
          {tab === "customize" && (
            <div className="space-y-5">
              {/* Skin color */}
              <div>
                <p className={label}>{L("Skin Tone")}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setSkinColor(""); saveConfig({ skinColor: "" }); }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] transition ${
                      !skinColor ? ringSel : t("bg-surface/70 text-text-muted ring-1 ring-[rgb(var(--rule))]", "bg-white/10")
                    }`}
                    title="Auto"
                  >
                    A
                  </button>
                  {SKIN_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setSkinColor(c); saveConfig({ skinColor: c }); }}
                      className={`h-8 w-8 rounded-full transition hover:scale-110 ${
                        skinColor === c ? ringSel : ""
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Hair color */}
              <div>
                <p className={label}>{L("Hair Color")}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setHairColor(""); saveConfig({ hairColor: "" }); }}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] transition ${
                      !hairColor ? ringSel : t("bg-surface/70 text-text-muted ring-1 ring-[rgb(var(--rule))]", "bg-white/10")
                    }`}
                    title="Auto"
                  >
                    A
                  </button>
                  {HAIR_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setHairColor(c); saveConfig({ hairColor: c }); }}
                      className={`h-8 w-8 rounded-full transition hover:scale-110 ${
                        hairColor === c ? ringSel : ""
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Background color */}
              <div>
                <p className={label}>{L("Avatar Background")}</p>
                <div className="flex flex-wrap gap-2">
                  {BG_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { setBgColor(c); saveConfig({ bgColor: c }); }}
                      className={`h-8 w-8 rounded-full border transition hover:scale-110 ${
                        bgColor === c ? ringSel : "border-line/20"
                      }`}
                      style={{ background: c === "transparent" ? "repeating-conic-gradient(#333 0% 25%, #555 0% 50%) 50% / 8px 8px" : c }}
                      title={c === "transparent" ? "No background" : c}
                    />
                  ))}
                </div>
              </div>

              {/* Background gradient */}
              <div>
                <p className={label}>{L("Gradient Background")}</p>
                <div className="grid grid-cols-4 gap-2">
                  {GRADIENTS.map((g) => (
                    <button
                      key={g}
                      onClick={() => { onColorSelect?.(g); }}
                      className={`h-10 rounded-lg transition hover:scale-105 ${
                        currentColor === g ? ringSel : ""
                      }`}
                      style={{ background: g }}
                    />
                  ))}
                </div>
              </div>

              {/* More seed presets */}
              <div>
                <p className={label}>{L("More Faces")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {SEED_PRESETS.slice(15).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSeed(s); saveConfig({ seed: s }); }}
                      className={`${chipBase} ${
                        seed === s ? chipOn : chipOff
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ──── EMOJI TAB ──── */}
          {tab === "emoji" && (
            <div className="space-y-3">
              <p className={t("text-center text-[13px] text-text-muted", "text-center text-xs text-text-dim")}>Pick an emoji that represents you</p>
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                {EMOJI_FACES.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setAvatarMode("emoji");
                      onEmojiSelect?.(emoji);
                    }}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition hover:scale-110 hover:bg-white/10 ${
                      currentEmoji === emoji && avatarMode === "emoji" ? t("bg-[rgb(var(--lamp)/0.16)] ring-2 ring-[rgb(var(--lamp)/0.55)]", "bg-primary/20 ring-2 ring-primary/50") : t("bg-surface/50", "bg-white/[0.03]")
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ──── PHOTO UPLOAD TAB ──── */}
          {tab === "upload" && (
            <div className="space-y-4">
              <div
                onClick={() => fileRef.current?.click()}
                className={t("group flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[rgb(var(--rule))] bg-surface/40 px-6 py-9 transition hover:border-[rgb(var(--lamp)/0.45)] hover:bg-[rgb(var(--lamp)/0.05)]", "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line/20 bg-white/[0.02] px-6 py-8 transition hover:border-primary/30 hover:bg-primary/5")}
              >
                {lamp ? (
                  <ImagePlus className="h-10 w-10 text-text-dim transition group-hover:-translate-y-1 group-hover:text-primary" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                <svg className="h-10 w-10 text-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                )}
                {uploading ? (
                  <p className="text-sm text-primary">Uploading...</p>
                ) : (
                  <>
                    <p className={t("text-sm font-medium text-text-primary", "text-sm text-white")}>{lamp ? "Choose a photo to upload" : "Click to upload a photo"}</p>
                    <p className="text-xs text-text-dim">JPG, PNG or GIF — Max 2MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setAvatarMode("photo");
                    onPhotoUpload?.(file);
                  }
                }}
              />
              {avatarUrl && (
                <p className="text-center text-xs text-success">Photo uploaded successfully</p>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
