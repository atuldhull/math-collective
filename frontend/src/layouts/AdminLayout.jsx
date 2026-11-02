/**
 * AdminLayout — Admin portal shell.
 * Renders the shared Lamplight AppShell with the Admin rail. Role gating
 * happens one level up in ProtectedRoute.
 */
import { ArrowLeftRight } from "lucide-react";
import { adminRail, adminDock } from "@/app/navigation";
import AppShell from "./AppShell";

const groups = [
  ...adminRail,
  { label: "Elsewhere", items: [{ to: "/dashboard", label: "Student app", icon: ArrowLeftRight }] },
];

export default function AdminLayout() {
  return <AppShell groups={groups} dock={adminDock} badge="Admin" homeTo="/admin" />;
}
