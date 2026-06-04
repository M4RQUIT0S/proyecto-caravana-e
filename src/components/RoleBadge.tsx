"use client";

import type { Rol } from "@/lib/types";
import { Shield, UserCog, Eye, HardHat } from "lucide-react";

const map: Record<Rol, { label: string; color: string; Icon: any }> = {
  admin: { label: "Productor", color: "text-accent border-accent/40 bg-accent/10", Icon: Shield },
  operador: {
    label: "Operador delegado",
    color: "text-warning border-warning/30 bg-warning/10",
    Icon: HardHat,
  },
  usuario: {
    label: "Usuario",
    color: "text-info border-info/30 bg-info/10",
    Icon: UserCog,
  },
  vista: {
    label: "Sólo vista",
    color: "text-ink-muted border-line bg-bg-soft",
    Icon: Eye,
  },
};

export function RoleBadge({ rol }: { rol: Rol }) {
  const m = map[rol];
  const Icon = m.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.color}`}
    >
      <Icon size={12} />
      {m.label}
    </span>
  );
}
