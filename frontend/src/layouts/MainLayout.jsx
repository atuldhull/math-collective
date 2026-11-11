/**
 * MainLayout — the layout for the whole app.
 *
 * Everyone lands here, visitor or member: one design for both. Every
 * route, the home page included, renders in the AppShell with the
 * practice / compete / your-work rail. The home page used to keep its
 * own pre-redesign shell, which left it as the one screen the redesign
 * never reached.
 */
import { studentDock, studentRail } from "@/app/navigation";
import AppShell from "./AppShell";

export default function MainLayout() {
  return <AppShell groups={studentRail} dock={studentDock} homeTo="/dashboard" />;
}
