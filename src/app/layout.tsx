import "./globals.css";
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
