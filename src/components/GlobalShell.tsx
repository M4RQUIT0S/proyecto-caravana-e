import { Navbar } from "@/components/Navbar";

// Shell para las páginas globales (dashboard, invitaciones): barra superior + contenedor
// centrado. Las páginas de un campo usan su propio layout con sidebar (AgroTrace).
export function GlobalShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">{children}</main>
    </>
  );
}
