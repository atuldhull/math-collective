import express from "express";
import { imageFileFilter } from "../lib/uploadNaming.js";
import multer  from "multer";
import { getGallery, uploadImage, deleteImage, createCategory } from "../controllers/galleryController.js";
import { requireTeacher, requireAdmin } from "../middleware/authMiddleware.js";

/* memoryStorage, not diskStorage: the file goes straight to Cloudinary,
   so writing it to Render's ephemeral disk first only added a temp file
   to clean up and a directory that was never served. 15MB is well within
   what the instance can hold briefly, and the fileFilter rejects anything
   that is not a JPEG/PNG/WebP/GIF before a byte is buffered. */
const upload = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: 15 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

const router = express.Router();

router.get("/",                  getGallery);
router.post("/upload",           requireTeacher, upload.single("image"), uploadImage);
router.delete("/",               requireAdmin,   deleteImage);
router.post("/category",         requireAdmin,   createCategory);

export default router;