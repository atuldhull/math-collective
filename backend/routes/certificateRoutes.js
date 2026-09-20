import express  from "express";
import { imageFileFilter, safeFilename } from "../lib/uploadNaming.js";
import multer   from "multer";
import path     from "path";
import { fileURLToPath } from "url";
import {
  uploadAsset,
  previewCertificate,
  matchStudents,
  createCertificateBatch,
  downloadCertificate,
  downloadBatchZip,
  getBatches,
  getMyCertificates,
  deleteBatch,
  verifyCertificate,
} from "../controllers/certificateController.js";
import { requireAuth, requireTeacher, checkFeatureFlag } from "../middleware/authMiddleware.js";
import { validateBody } from "../validators/common.js";
import { matchStudentsSchema, createCertificateBatchSchema } from "../validators/certificates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "public", "uploads", "cert-assets");
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Extension comes from the DETECTED type, not from the uploader.
    cb(null, safeFilename(req.query.type || "asset", file.mimetype));
  },
});

const upload = multer({
  storage,
  fileFilter: imageFileFilter,   // SVG deliberately excluded — it can carry <script>
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const router = express.Router();

// Upload a single logo or signature image
// query: ?type=logo|signature|extra
router.post("/upload-asset",      requireTeacher, upload.single("asset"), uploadAsset);

// Preview (generates real LaTeX PDF)
router.post("/preview",           requireTeacher, previewCertificate);

// Match recipients to registered students by email
router.post("/match-students",    requireTeacher, validateBody(matchStudentsSchema), matchStudents);

// Create certificate batch
router.post("/create",            requireTeacher, checkFeatureFlag("certificates"), validateBody(createCertificateBatchSchema), createCertificateBatch);

// Batch management
router.get("/batches",            requireTeacher, getBatches);
router.delete("/batches/:id",     requireTeacher, deleteBatch);
router.get("/batch/:batchId/zip", requireTeacher, downloadBatchZip);

// Student endpoints
router.get("/download/:id",       requireAuth,    downloadCertificate);
router.get("/mine",               requireAuth,    getMyCertificates);

// Public verification — no auth. Anyone with the token (e.g.
// scanning the QR on a cert) can confirm it's genuine. Returns
// only display-safe fields (name, event, date, issuer) — never
// email or batch data that could be used for phishing.
router.get("/verify/:token",      verifyCertificate);

export default router;