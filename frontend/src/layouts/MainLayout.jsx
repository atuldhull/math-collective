/**
 * MainLayout — the member layout for the student app.
 *
 * Only members reach it (SessionPresentation hands visitors the public
 * layout). On "/" a member still gets the original home with its own
 * header and footer (LegacyMainLayout); every other route renders in
 * the AppShell with the practice / compete / your-work rail.
 */
import { useLocation } from "react-router-dom";
import { studentDock, studentRail } from "@/app/navigation";
import AppShell from "./AppShell";
import LegacyMainLayout from "./LegacyMainLayout";

export default function MainLayout() {
  const { pathname } = useLocation();
  if (pathname === "/") return <LegacyMainLayout />;
  return <AppShell groups={studentRail} dock={studentDock} homeTo="/dashboard" />;
}
