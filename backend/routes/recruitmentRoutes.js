import { Router } from "express";
import { submitRecruitment } from "../controllers/recruitmentController.js";
import { validateBody } from "../validators/common.js";
import { recruitmentSchema } from "../validators/recruitment.js";
import { registerIpLimiter } from "../middleware/rateLimiter.js";

const router = Router();
router.post("/", registerIpLimiter, validateBody(recruitmentSchema), submitRecruitment);
export default router;
