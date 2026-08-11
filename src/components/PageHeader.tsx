"use client";

import type { LucideIcon } from "lucide-react";

// Cabecera de pantalla. Antes traia un icono metido en una pastilla de color con anillo
// (bg-accent/10 + ring) y una animacion de entrada: decoracion sin funcion, repetida en
// las 15 pantallas, que es de lo que mas delata un diseño generado. El icono se conserva
// como parametro para no tocar las 15 llamadas, pero ya no se pinta.
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="label mb-1.5">{eyebrow}</div>}
        <h1 className="font-display text-2xl leading-tight text-ink text-balance sm:text-[28px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
