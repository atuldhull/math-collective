/**
 * TeacherLayout — Teacher portal shell.
 * Renders the shared Lamplight AppShell with the Teacher rail. Role gating
 * happens one level up in ProtectedRoute.
 */
import { ArrowLeftRight } from "lucide-react";
import { teacherRail, teacherDock } from "@/app/navigation";
import AppShell from "./AppShell";

const groups = [
  ...teacherRail,
  { label: "Elsewhere", items: [{ to: "/dashboard", label: "Student app", icon: ArrowLeftRight }] },
];

export default function TeacherLayout() {
  return <AppShell groups={groups} dock={teacherDock} badge="Teacher" homeTo="/teacher" />;
}
