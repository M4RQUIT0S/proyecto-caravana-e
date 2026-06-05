"use client";

// Componentes compartidos del design system AgroTrace: tono semántico (feedback tokens)
// reutilizado por tarjetas de métrica, badges de estado y chips. Centraliza el mapeo
// success/warning/error/info para mantener consistencia visual entre pantallas.

import type { ReactNode } from "react";

export type Tono = "success" | "warning" | "error" | "info" | "neutral";

export const TONO_CLASES: Record<
  Tono,
  { border: string; icon: string; dot: string; chipBg: string; chipText: string }
> = {
  success: { border: "border-success/40", icon: "text-success", dot: "bg-success", chipBg: "bg-success/12", chipText: "text-success" },
  warning: { border: "border-warning/40", icon: "text-warning", dot: "bg-warning", chipBg: "bg-warning/12", chipText: "text-warning" },
  error: { border: "border-error/40", icon: "text-error", dot: "bg-error", chipBg: "bg-error/12", chipText: "text-error" },
  info: { border: "border-info/40", icon: "text-info", dot: "bg-info", chipBg: "bg-info/12", chipText: "text-info" },
  neutral: { border: "border-line", icon: "text-ink-dim", dot: "bg-ink-dim", chipBg: "bg-bg-soft", chipText: "text-ink-muted" },
};

// Chip/badge de estado con tono semántico (p. ej. "Aceptado", "Rechazado", "En carencia").
export function TonoBadge({
  tono = "neutral",
  children,
  className = "",
}: {
  tono?: Tono;
  children: ReactNode;
  className?: string;
}) {
  const t = TONO_CLASES[tono];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${t.chipBg} ${t.chipText} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden />
      {children}
    </span>
  );
}
