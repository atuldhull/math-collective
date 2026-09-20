/**
 * lib/uploadNaming.js — derive an upload's extension from its DETECTED
 * type, never from the name the uploader chose.
 *
 * Both upload routes used `path.extname(file.originalname)`, so the
 * stored file kept whatever suffix the client sent. Those folders are
 * not publicly served today, which is why this was only a low-severity
 * finding — but it is one static-mount away from being a way to place
 * an arbitrarily-named file on disk.
 *
 * SVG is deliberately absent. An SVG is a document: it can carry
 * <script>, and serving one from our own origin makes it stored XSS.
 * The certificate asset upload used to accept image/svg+xml.
 */

const EXT_BY_MIME = Object.freeze({
  "image/jpeg": ".jpg",
  "image/png":  ".png",
  "image/webp": ".webp",
  "image/gif":  ".gif",
});

export const ALLOWED_IMAGE_MIMES = Object.freeze(Object.keys(EXT_BY_MIME));

export function extensionFor(mimetype) {
  return EXT_BY_MIME[mimetype] || null;
}

/** multer fileFilter that accepts only the types above. */
export function imageFileFilter(_req, file, cb) {
  const ok = ALLOWED_IMAGE_MIMES.includes(file.mimetype);
  if (!ok) {
    cb(new Error("Only JPEG, PNG, WebP or GIF images are allowed"), false);
    return;
  }
  cb(null, true);
}

/** multer filename builder: `<prefix>_<time>_<rand><detected ext>`. */
export function safeFilename(prefix, mimetype) {
  const ext  = extensionFor(mimetype) || ".bin";
  const rand = Math.random().toString(36).slice(2, 6);
  const safe = String(prefix || "file").replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "file";
  return `${safe}_${Date.now()}_${rand}${ext}`;
}
