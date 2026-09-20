/**
 * Login / Register — guest-only (authenticated users bounce to their
 * role-specific dashboard via GuestOnlyRoute).
 *
 * /reset-password is deliberately NOT guest-only: a member who is still
 * signed in on this device and clicks the link from their recovery
 * email needs to reach the form, not get redirected to their dashboard.
 */

import { lazy } from "react";
import { Route } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import GuestOnlyRoute from "@/components/auth/GuestOnlyRoute";

const LoginPage         = lazy(() => import("@/features/auth/pages/LoginPage"));
const RegisterPage      = lazy(() => import("@/features/auth/pages/RegisterPage"));
const ResetPasswordPage = lazy(() => import("@/features/auth/pages/ResetPasswordPage"));

export const authRoutes = (
  <Route element={<AuthLayout />}>
    <Route path="login"          element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
    <Route path="register"       element={<GuestOnlyRoute><RegisterPage /></GuestOnlyRoute>} />
    <Route path="reset-password" element={<ResetPasswordPage />} />
  </Route>
);
