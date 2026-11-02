/**
 * SuperAdminLayout — Super-admin portal shell.
 * Renders the shared Lamplight AppShell with the Super-admin rail. Role gating
 * happens one level up in ProtectedRoute.
 */
import { ArrowLeftRight } from "lucide-react";
import { superAdminRail, superAdminDock } from "@/app/navigation";
import AppShell from "./AppShell";

const groups = [
  ...superAdminRail,
  { label: "Elsewhere", items: [{ to: "/dashboard", label: "Student app", icon: ArrowLeftRight }] },
];

export default function SuperAdminLayout() {
  return <AppShell groups={groups} dock={superAdminDock} badge="Super admin" homeTo="/super-admin" />;
}
