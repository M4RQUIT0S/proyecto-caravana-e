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
  ScanLine,
  Syringe,
  Scale,
  ArrowRightLeft,
  BarChart3,
  ShieldCheck,
  BookMarked,
} from "lucide-react";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/context";
import { RoleBadge } from "@/components/RoleBadge";
import { useOnline } from "@/lib/conectividad";
import { contarPendientes } from "@/lib/reglas";
import { puede, permisosDe, type Accion } from "@/lib/permisos";

const tabs: { href: string; label: string; icon: any; perm?: Accion }[] = [
  { href: "", label: "Resumen", icon: LayoutDashboard },
  { href: "/manga", label: "Manga", icon: ScanLine, perm: "capturar" },
  { href: "/animales", label: "Animales", icon: Tags },
  { href: "/lotes", label: "Lotes", icon: Layers },
  { href: "/sanidad", label: "Sanidad", icon: Syringe, perm: "sanidad" },
  { href: "/pesajes", label: "Pesajes", icon: Scale, perm: "pesaje" },
  { href: "/movimientos", label: "Movimientos", icon: ArrowRightLeft, perm: "movimiento" },
  { href: "/reportes", label: "Reportes", icon: BarChart3, perm: "reportes" },
  { href: "/senasa", label: "SENASA", icon: ShieldCheck, perm: "senasa" },
  { href: "/catalogos", label: "Catálogos", icon: BookMarked, perm: "catalogos" },
  { href: "/usuarios", label: "Usuarios", icon: Users },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/sigsa", label: "Bot SIGSA", icon: Bot },
];

export default function CampoLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const { db, user } = useApp();
  const online = useOnline();
  const pendientes = contarPendientes(
    db.eventos.filter((e) => e.campoId === params.id)
  );
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

  const miembro = campo.miembros.find((m) => m.userId === user?.id);
  const permisos = permisosDe(miembro);
  const tabsVisibles = tabs.filter((t) => !t.perm || puede(rol, t.perm, permisos));

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
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              online
                ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"
                : "text-red-300 border-red-400/30 bg-red-400/10"
            }`}
            title={online ? "Con conexión" : "Sin conexión: capturás offline, se sincroniza después (RNF-01)"}
          >
            {online ? <Wifi size={12} /> : <WifiOff size={12} />}
            {online ? "En línea" : "Sin conexión"}
          </span>
          {pendientes > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-0.5 text-xs font-medium text-amber-300"
              title="Registros en cola de sincronización (RNF-08). Nada se pierde."
            >
              <RefreshCw size={12} /> {pendientes} en cola
            </span>
          )}
          <RoleBadge rol={rol} />
          <span className="chip font-mono uppercase">{campo.codigo}</span>
        </div>
      </motion.div>

      <div className="border-b border-line mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabsVisibles.map((t) => {
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
