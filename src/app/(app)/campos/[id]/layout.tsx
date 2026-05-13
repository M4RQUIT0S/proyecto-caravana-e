"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  LayoutDashboard,
  Layers,
  Users,
  Upload,
  Tags,
  Bot,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { RoleBadge } from "@/components/RoleBadge";

const tabs = [
  { href: "", label: "Resumen", icon: LayoutDashboard },
  { href: "/lotes", label: "Lotes", icon: Layers },
  { href: "/animales", label: "Animales", icon: Tags },
  { href: "/usuarios", label: "Usuarios", icon: Users },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/sigsa", label: "Bot SIGSA", icon: Bot },
];

export default function CampoLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const { db, user } = useApp();
  const campo = db.campos.find((c) => c.id === params.id);

  if (!campo)
    return (
      <div className="card p-10 text-center text-ink-muted">
        Este campo no existe o ya no tenés acceso.{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Volver al dashboard
        </Link>
      </div>
    );

  const rol =
    campo.ownerId === user?.id
      ? "admin"
      : campo.miembros.find((m) => m.userId === user?.id)?.rol;

  if (!rol)
    return (
      <div className="card p-10 text-center text-ink-muted">
        No formás parte de este campo.{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Volver
        </Link>
      </div>
    );

  return (
    <div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4"
      >
        <ArrowLeft size={14} /> Volver a mis campos
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6"
      >
        <div>
          <div className="label mb-1">Campo</div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink">
            {campo.nombre}
          </h1>
          {campo.descripcion && (
            <p className="text-ink-muted mt-1 text-sm">{campo.descripcion}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RoleBadge rol={rol} />
          <span className="chip font-mono uppercase">{campo.codigo}</span>
        </div>
      </motion.div>

      <div className="border-b border-line mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((t) => {
            const Icon = t.icon;
            const full = `/campos/${campo.id}${t.href}`;
            const active =
              t.href === ""
                ? pathname === `/campos/${campo.id}`
                : pathname?.startsWith(full);
            return (
              <Link
                key={t.href}
                href={full}
                className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm whitespace-nowrap transition ${
                  active ? "text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon size={14} />
                {t.label}
                {active && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute -bottom-px left-0 right-0 h-0.5 bg-accent"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
