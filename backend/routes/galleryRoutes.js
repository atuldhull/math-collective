import express from "express";
import { imageFileFilter, safeFilename } from "../lib/uploadNaming.js";
import multer  from "multer";
import path    from "path";
import fs      from "fs";
import { fileURLToPath } from "url";
import { getGallery, uploadImage, deleteImage, createCategory } from "../controllers/galleryController.js";
import { requireTeacher, requireAdmin } from "../middleware/authMiddleware.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getTmpDir = () => {
  const tmpDir = path.join(__dirname, "..", "public", "images", "_tmp");
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, getTmpDir()),
  filename:    (req, file, cb) => {
    // Extension comes from the DETECTED type, not from the uploader.
    cb(null, safeFilename("img", file.mimetype));
  },
});

const upload = multer({
  storage,
  limits:     { fileSize: 15 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const router = express.Router();

router.get("/",                  getGallery);
router.post("/upload",           requireTeacher, upload.single("image"), uploadImage);
router.delete("/",               requireAdmin,   deleteImage);
router.post("/category",         requireAdmin,   createCategory);

export default router;