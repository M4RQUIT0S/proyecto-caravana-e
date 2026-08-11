import "./globals.css";
// Inter auto-hospedada (variable). Antes se cargaba con un @import a
// fonts.googleapis.com desde globals.css y la CSP (`style-src 'self' 'unsafe-inline'`)
// bloqueaba esa hoja: la petición transfería 0 bytes, document.fonts quedaba vacío y
// todos los usuarios veían la fuente del sistema. Servida desde el propio origen cumple
// `font-src 'self'`, no hace ninguna petición a un tercero (ni filtra la IP del usuario)
// y no bloquea el render. Se usa el paquete y no next/font/google porque este último no
// resuelve bajo Turbopack en Next 16.
import "@fontsource-variable/inter/index.css";
import type { Metadata } from "next";
import { AppProvider } from "@/lib/context";

export const metadata: Metadata = {
  title: "AgroTrace",
  description: "Trazabilidad ganadera: campos, lotes y animales con caravanas RFID.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
