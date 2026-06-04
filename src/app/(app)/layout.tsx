import { AuthGuard } from "@/components/AuthGuard";

// El layout global sólo protege la sesión. Cada sección decide su chrome:
//  - páginas globales (dashboard, invitaciones) usan <GlobalShell> (Navbar + centrado);
//  - las páginas de un campo usan su propio layout con sidebar + top bar (AgroTrace).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
