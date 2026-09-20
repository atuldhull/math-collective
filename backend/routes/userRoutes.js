import express from "express";
import { getProfile, updateProfile, getUserStats, changePassword, getTestHistory } from "../controllers/userController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateBody } from "../validators/common.js";
import { updateProfileSchema, changePasswordSchema } from "../validators/user.js";
import { sendInternalError } from "../lib/errorResponse.js";

const router = express.Router();

router.get("/profile",          requireAuth, getProfile);
router.patch("/profile",        requireAuth, validateBody(updateProfileSchema),  updateProfile);
router.get("/stats",            requireAuth, getUserStats);
router.post("/change-password", requireAuth, validateBody(changePasswordSchema), changePassword);
router.get("/test-history",     requireAuth, getTestHistory);

// Public student profile (for viewing other students)
router.get("/student/:userId",  requireAuth, async (req, res) => {
  try {
    // Was a private service-role client, which bypassed tenant scoping:
    // any signed-in student could read ANY student in ANY organisation.
    // req.db is org-scoped, so a cross-org id now simply is not found.
    //
    // email is also gone from the projection. This is the profile card
    // other members see; their address is not part of it.
    const { data } = await req.db
      .from("students")
      .select("user_id, name, xp, weekly_xp, title, bio, avatar_emoji, avatar_color, avatar_config, role, department")
      .eq("user_id", req.params.userId)
      .maybeSingle();
    if (!data) return res.status(404).json({ error: "Student not found" });
    res.json(data);
  } catch (err) {
    sendInternalError(res, err);
  }
});

export default router;
