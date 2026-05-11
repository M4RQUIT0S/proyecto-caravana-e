"use client";

import type { Rol } from "@/lib/types";
import { Shield, UserCog, Eye } from "lucide-react";

const map: Record<Rol, { label: string; color: string; Icon: any }> = {
  admin: { label: "Admin", color: "text-accent border-accent/40 bg-accent/10", Icon: Shield },
  usuario: {
    label: "Usuario",
    color: "text-sky-300 border-sky-300/30 bg-sky-300/10",
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
