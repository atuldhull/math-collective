import { lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil } from "lucide-react";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";

// Lazy-load AvatarCreator: it brings in @dicebear/collection (~1MB of
// SVG avatar styles) and is only rendered when the user enters the
// profile-edit state. Lazy-loading splits it into its own chunk, so
// the initial profile-page paint isn't paying for an avatar builder
// the user almost never opens.
const AvatarCreator = lazy(() => import("@/components/ui/AvatarCreator"));

const AVATAR_RING = {
  border: "2px solid rgb(var(--lamp)/0.7)",
  boxShadow: "0 0 0 6px rgb(var(--lamp)/0.08), 0 14px 40px -12px rgb(var(--lamp)/0.55)",
};

export default function ProfileInfoCard({
  profile,
  editing,
  setEditing,
  editName,
  setEditName,
  editBio,
  setEditBio,
  saving,
  saveMsg,
  saveErr,
  uploadingAvatar,
  onSave,
  onCancel,
  onAvatarChange,
  onEmojiSelect,
  onColorSelect,
  onConfigChange,
  currentTitle,
  level,
}) {
  // avatar_config holds the current avatar source. Two shapes today:
  //   { type: "photo", dataUrl: "data:image/..." }   uploaded by user
  //   anything else                                  fall back to emoji/color
  // Legacy users with a real avatar_url field still render through this.
  const avatarUrl = profile.avatar_url
    || (profile.avatar_config?.type === "photo" ? profile.avatar_config.dataUrl : null);
  const initial = (profile.name || "U").charAt(0).toUpperCase();

  return (
    <section data-reveal="scale" className="lamp-panel lamp-panel--lit p-5 sm:p-7">
      <AnimatePresence mode="wait">
        {!editing ? (
          <motion.div
            key="view"
            initial={{ opacity: 0, rotateX: -8, y: 10 }}
            animate={{ opacity: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, rotateX: 8, y: -10 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >
            {/* Avatar + basic info */}
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="group relative shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile.name}
                    loading="lazy"
                    className="h-20 w-20 rounded-full object-cover sm:h-24 sm:w-24"
                    style={AVATAR_RING}
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full text-3xl sm:h-24 sm:w-24 sm:text-4xl"
                    style={{
                      background: profile.avatar_color || "linear-gradient(135deg, rgb(var(--violet)), rgb(var(--lamp)/0.8))",
                      ...AVATAR_RING,
                    }}
                  >
                    {profile.avatar_emoji || initial}
                  </div>
                )}

                {/* Upload overlay */}
                <button
                  onClick={() => setEditing(true)}
                  aria-label="Edit avatar"
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-obsidian/60 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <span className="inline-flex items-center gap-1 text-[13px] font-medium text-text-primary">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /> Edit
                  </span>
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="lamp-display truncate text-2xl text-text-primary sm:text-3xl">
                  {profile.name}
                </h2>
                <p className="truncate text-sm text-text-muted">{profile.email}</p>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className="max-w-[62ch] text-[15px] leading-7 text-text-muted">{profile.bio}</p>
            )}

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[rgb(var(--rule))] px-3 py-1 text-[13px] capitalize text-text-muted">
                {profile.role || "Student"}
              </span>
              <span className="rounded-full border border-secondary/30 bg-secondary/12 px-3 py-1 text-[13px] tabular-nums text-secondary">
                Level {level}
              </span>
              <span className="rounded-full bg-primary px-3 py-1 text-[13px] font-medium text-[rgb(var(--color-obsidian))]">
                {currentTitle.title}
              </span>
            </div>

            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} leading={<Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />}>
              Edit Profile
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0, rotateX: -8, y: 10 }}
            animate={{ opacity: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, rotateX: 8, y: -10 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <h2 className="lamp-display text-2xl text-text-primary">Edit your profile</h2>
            {/* ── Full Avatar Creator (lazy-loaded) ── */}
            <div className="rounded-2xl border border-[rgb(var(--rule))] bg-obsidian/30 p-4 sm:p-5">
              <p className="mb-4 text-[13px] font-medium text-text-muted">Your avatar</p>
              <Suspense fallback={
                <div className="flex h-40 items-center justify-center text-[13px] text-text-dim">
                  Loading avatar builder…
                </div>
              }>
                <AvatarCreator
                  currentEmoji={profile.avatar_emoji || "😎"}
                  currentColor={profile.avatar_color || "linear-gradient(135deg,#7c3aed,#3b82f6)"}
                  currentConfig={profile.avatar_config}
                  avatarUrl={avatarUrl}
                  uploading={uploadingAvatar}
                  onEmojiSelect={onEmojiSelect}
                  onColorSelect={onColorSelect}
                  onConfigChange={onConfigChange}
                  onPhotoUpload={onAvatarChange}
                />
              </Suspense>
            </div>

            {/* ── Name & Bio Fields ── */}
            <InputField
              label="Display Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Your name"
            />

            <InputField
              label="Bio"
              multiline
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Tell the collective about yourself — what do you study, what math excites you?"
              helper="Visible to other students on the leaderboard"
            />

            <AnimatePresence>
              {saveMsg && (
                <motion.p key="ok" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-success/20 bg-success/10 px-3 py-2 text-sm text-success">
                  {saveMsg}
                </motion.p>
              )}
              {saveErr && (
                <motion.p key="err" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: [0, -6, 5, -3, 0] }} exit={{ opacity: 0 }} className="rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {saveErr}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="sm" loading={saving} onClick={onSave}>
                Save Changes
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
