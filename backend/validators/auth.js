/**
 * Zod schemas for /api/auth/* endpoints.
 *
 * Each schema is paired with an Express middleware via validateBody()
 * in authRoutes.js. Replaces the ad-hoc `if (!email) return 400...`
 * checks that were scattered across authController.
 *
 * Policy notes:
 *   - We don't validate the SHAPE of an auth token or password against
 *     an arbitrary "strength" rule here — Supabase's own checks are
 *     authoritative (rejection comes back via signInWithPassword /
 *     updateUserById). We only enforce the invariants we own:
 *       * format (email must be an email)
 *       * presence (password can't be the empty string)
 *       * length caps (DoS defence — a 10MB "password" field would
 *         otherwise reach bcrypt)
 *   - Every schema that SETS a new password shares the floor from
 *     lib/passwordPolicy.js, so register / reset / change can no longer
 *     drift apart. Login has no floor: an existing account's password
 *     could be anything Supabase once accepted, and those members still
 *     have to be able to sign in.
 */

import { z } from "zod";
import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  PASSWORD_TOO_SHORT,
  PASSWORD_TOO_LONG,
} from "../lib/passwordPolicy.js";

const email       = z.string().trim().toLowerCase()
  .email("must be a valid email")
  .max(320, "email too long");

const password    = z.string()
  .min(1, "password required")
  .max(MAX_PASSWORD_LENGTH, PASSWORD_TOO_LONG);

const newPassword = z.string()
  .min(MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT)
  .max(MAX_PASSWORD_LENGTH, PASSWORD_TOO_LONG);

export const registerSchema = z.object({
  email,
  password: newPassword,
  name:         z.string().trim().min(1).max(100).optional(),
  invite_token: z.string().trim().min(1).max(200).optional(),
});

export const loginSchema = z.object({
  email,
  password,
});

export const forgotPasswordSchema = z.object({
  email,
});

/* A recovery link arrives in one of two shapes, depending on which
   email template the Supabase project is on:
     - implicit flow → #access_token=...&type=recovery
     - OTP-hash flow → ?token_hash=...&type=recovery
   The endpoint accepts either, so nobody is stranded on a link the UI
   happened not to parse. Exactly one of the two must be present. */
export const resetPasswordSchema = z.object({
  access_token: z.string().min(1).max(4096).optional(),
  token_hash:   z.string().min(1).max(4096).optional(),
  new_password: newPassword,
}).refine(
  (v) => Boolean(v.access_token) !== Boolean(v.token_hash),
  { path: ["access_token"], message: "a recovery token is required" },
);

export const resendVerificationSchema = z.object({
  email,
});
