import { AuthGuard } from "@/components/AuthGuard";
import { SyncBanner } from "@/components/SyncBanner";

// El layout global protege la sesión y avisa si algo no se pudo guardar en el servidor.
// Cada sección decide su chrome:
//  - páginas globales (dashboard, invitaciones) usan <GlobalShell> (Navbar + centrado);
//  - las páginas de un campo usan su propio layout con sidebar + top bar (AgroTrace).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SyncBanner />
      {children}
    </AuthGuard>
  );
}
