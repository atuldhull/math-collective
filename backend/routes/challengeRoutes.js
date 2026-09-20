import express from "express";
import {
  getCurrentChallenge,
  getNextChallenge,
  getAllChallenges,
  getChallengeById,
  createChallenge,
  updateChallenge,
  deleteChallenge,
  toggleChallenge,
} from "../controllers/challengeController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { validateBody } from "../validators/common.js";
import { createChallengeSchema, updateChallengeSchema } from "../validators/challenges.js";

const router = express.Router();

/* Challenge reads require a session. These endpoints hand out the
   questions that arena XP is scored on, so they are not public — an
   anonymous client has no legitimate reason to enumerate the bank.
   The controller additionally withholds correct_index and solution
   from anyone who is not staff. */
router.get("/current",  requireAuth, getCurrentChallenge);
router.get("/next",     requireAuth, getNextChallenge);    // random unsolved challenge
router.get("/all",      requireAuth, getAllChallenges);
router.get("/:id",      requireAuth, getChallengeById);

// Admin-only
router.post("/",              requireAdmin, validateBody(createChallengeSchema), createChallenge);
router.patch("/:id",          requireAdmin, validateBody(updateChallengeSchema), updateChallenge);
router.delete("/:id",         requireAdmin, deleteChallenge);
router.patch("/:id/toggle",   requireAdmin, toggleChallenge);

export default router;
