/**
 * controllers/galleryController.js
 *
 * The gallery used to exist twice, and neither copy worked.
 *
 *   - This API wrote uploads to `backend/public/images`, a directory the
 *     server never served. Render also wipes the filesystem on every
 *     deploy, so anything an admin uploaded was both unreachable AND
 *     temporary — failing silently in two different ways at once.
 *   - The gallery PAGE ignored this API completely and rendered a
 *     hardcoded list of Cloudinary URLs, which meant adding a photo
 *     required editing source and shipping a release.
 *
 * Both now point at Cloudinary, which is where the club's images already
 * lived. Uploads survive deploys, the listing is real, and an admin can
 * add a photo without a developer.
 *
 * Error handling: every handler is wrapped in catchAsync so an
 * unexpected throw reaches the global error handler in app.js
 * (structured pino log + a 500 carrying a request id), rather than
 * echoing a raw provider message back to the client.
 */

import fs from "node:fs/promises";
import { catchAsync } from "../lib/asyncHandler.js";
import { logger } from "../config/logger.js";
import {
  isConfigured,
  uploadImage as cloudUpload,
  listImages,
  destroyImage,
} from "../lib/cloudinary.js";

/** Turn a folder slug into something presentable: "tech-fest" → "Tech Fest". */
function titleise(slug) {
  return String(slug || "general")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ══════════════════════════════════════════
   GET ALL GALLERY IMAGES
   GET /api/gallery
   Returns images grouped by category (the Cloudinary folder).
══════════════════════════════════════════ */
export const getGallery = catchAsync(async (req, res) => {
  if (!isConfigured()) {
    // Not an error: a deployment without Cloudinary keys simply has no
    // managed gallery yet, and the page falls back to its curated list.
    logger.info("gallery: Cloudinary not configured — returning empty");
    return res.json({ categories: [], configured: false });
  }

  const images = await listImages({ max: 500 });

  const byCategory = new Map();
  for (const img of images) {
    if (!byCategory.has(img.category)) byCategory.set(img.category, []);
    byCategory.get(img.category).push(img);
  }

  const categories = [...byCategory.entries()]
    .map(([slug, imgs]) => ({
      slug,
      name: titleise(slug),
      // Newest first within a category — an admin who has just uploaded
      // expects to see it at the top rather than hunting for it.
      images: imgs
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map((i) => ({ url: i.url, publicId: i.publicId, width: i.width, height: i.height })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return res.json({ categories, configured: true });
});

/* ══════════════════════════════════════════
   UPLOAD IMAGE (admin/teacher only)
   POST /api/gallery/upload
   Multipart: field "image", query "category"
══════════════════════════════════════════ */
export const uploadImage = catchAsync(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  if (!isConfigured()) {
    return res.status(503).json({
      error: "Image hosting is not configured. Set the CLOUDINARY_* environment variables.",
    });
  }

  // multer hands back a buffer with memoryStorage or a path with
  // diskStorage. Support both, so changing the route's storage choice
  // cannot silently break uploads.
  const buffer = req.file.buffer || (req.file.path ? await fs.readFile(req.file.path) : null);
  if (!buffer) return res.status(400).json({ error: "Could not read the uploaded file" });

  const result = await cloudUpload(buffer, {
    category: req.query.category,
    filename: req.file.originalname,
  });

  // Best-effort cleanup of the temp file when multer used disk storage.
  if (req.file.path) {
    try {
      await fs.unlink(req.file.path);
    } catch { /* the OS reaps the temp dir; not worth failing the upload */ }
  }

  logger.info({ publicId: result.publicId, bytes: result.bytes }, "gallery: image uploaded");

  return res.json({ success: true, url: result.url, publicId: result.publicId });
});

/* ══════════════════════════════════════════
   DELETE IMAGE (admin only)
   DELETE /api/gallery
   Body: { publicId: "math-collective/inauguration/abc123" }
══════════════════════════════════════════ */
export const deleteImage = catchAsync(async (req, res) => {
  // `imagePath` is the old disk-era field name; accept it too so an
  // older client build does not break mid-deploy.
  const publicId = req.body?.publicId || req.body?.imagePath;
  if (!publicId) return res.status(400).json({ error: "publicId required" });

  if (!isConfigured()) {
    return res.status(503).json({ error: "Image hosting is not configured." });
  }

  // Containment: only ever delete inside our own namespace. Without this
  // an admin could pass any public id in the account and destroy the
  // club's other assets — including the curated photos the gallery page
  // still links to directly. Same role as the old resolved-path prefix
  // check, which guarded a directory rather than a namespace.
  if (!String(publicId).startsWith("math-collective/")) {
    return res.status(403).json({ error: "That image is not managed by the gallery" });
  }

  const result = await destroyImage(publicId);
  logger.info({ publicId, result }, "gallery: image deleted");
  return res.json({ success: true, result });
});

/* ══════════════════════════════════════════
   CREATE CATEGORY (admin only)
   POST /api/gallery/category

   Cloudinary folders exist once something is uploaded into them, so
   there is nothing to create up front. This validates the name and
   returns the slug the uploader should use, which keeps the admin UI's
   flow intact without pretending to have made a directory.
══════════════════════════════════════════ */
export const createCategory = catchAsync(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });

  const slug = String(name)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);

  if (!slug) return res.status(400).json({ error: "name must contain letters or numbers" });

  return res.json({
    success: true,
    slug,
    note: `Upload an image with ?category=${slug} to create this album.`,
  });
});
