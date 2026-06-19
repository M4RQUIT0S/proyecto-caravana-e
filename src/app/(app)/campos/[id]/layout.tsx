"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { RoleBadge } from "@/components/RoleBadge";
import { useApp } from "@/lib/context";
import { logout } from "@/lib/auth";
import { useOnline } from "@/lib/conectividad";
import { contarPendientes } from "@/lib/reglas";
import { puede, permisosDe, type Accion } from "@/lib/permisos";

const items: { href: string; label: string; icon: any; perm?: Accion }[] = [
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
  const router = useRouter();
  const { db, user, refresh } = useApp();
  const online = useOnline();
  const [navOpen, setNavOpen] = useState(false);

  const pendientes = contarPendientes(db.eventos.filter((e) => e.campoId === params.id));
  const campo = db.campos.find((c) => c.id === params.id);

  if (!campo)
    return (
      <Centro>
        Este campo no existe o ya no tenés acceso.{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Volver a mis campos
        </Link>
      </Centro>
    );

  const rol =
    campo.ownerId === user?.id
      ? "admin"
      : campo.miembros.find((m) => m.userId === user?.id)?.rol;

  if (!rol)
    return (
      <Centro>
        No formás parte de este campo.{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Volver
        </Link>
      </Centro>
    );

  const miembro = campo.miembros.find((m) => m.userId === user?.id);
  const permisos = permisosDe(miembro);
  const visibles = items.filter((t) => !t.perm || puede(rol, t.perm, permisos));
  const misCampos = db.campos.filter(
    (c) => c.ownerId === user?.id || c.miembros.some((m) => m.userId === user?.id)
  );
  // Sub-ruta dentro del campo (ej "/animales"), para conservar la sección al cambiar de establecimiento.
  const sub = pathname?.replace(`/campos/${campo.id}`, "") ?? "";

  function salir() {
    logout();
    refresh();
    router.push("/login");
  }

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {visibles.map((t) => {
        const Icon = t.icon;
        const full = `/campos/${campo!.id}${t.href}`;
        const active =
          t.href === "" ? pathname === `/campos/${campo!.id}` : pathname?.startsWith(full);
        return (
          <Link
            key={t.href}
            href={full}
            onClick={() => setNavOpen(false)}
            className={`inline-flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
              active
                ? "bg-accent text-white font-medium shadow-sm"
                : "text-ink-muted hover:bg-bg-soft hover:text-ink"
            }`}
          >
            <Icon size={17} className="shrink-0" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* TOP BAR */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg-card/90 backdrop-blur-xl px-3 sm:px-4">
        <button
          onClick={() => setNavOpen(true)}
          className="lg:hidden rounded-lg border border-line p-2 text-ink"
          aria-label="Menú"
        >
          <Menu size={18} />
        </button>
        <Link href="/dashboard" className="shrink-0">
          <Logo size={24} />
        </Link>

        {/* Switcher de establecimientos */}
        {misCampos.length > 0 && (
          <div className="hidden md:flex items-center gap-1 ml-2 overflow-x-auto">
            {misCampos.map((c) => {
              const activo = c.id === campo.id;
              return (
                <Link
                  key={c.id}
                  href={`/campos/${c.id}${sub}`}
                  className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
                    activo
                      ? "text-ink font-medium bg-bg-soft"
                      : "text-ink-muted hover:text-ink hover:bg-bg-soft/60"
                  }`}
                >
                  {c.nombre}
                </Link>
              );
            })}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              online
                ? "text-success border-success/30 bg-success/10"
                : "text-error border-error/30 bg-error/10"
            }`}
            title={online ? "Con conexión" : "Sin conexión: capturás offline"}
          >
            {online ? <Wifi size={12} /> : <WifiOff size={12} />}
            {online ? "En línea" : "Offline"}
          </span>
          {pendientes > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
              title="Registros en cola de sincronización"
            >
              <RefreshCw size={12} /> {pendientes}
            </span>
          )}
          <button
            className="rounded-lg p-2 text-ink-muted hover:text-ink hover:bg-bg-soft"
            title="Notificaciones"
            aria-label="Notificaciones"
          >
            <Bell size={16} />
          </button>
          <div className="flex items-center gap-2 rounded-full border border-line bg-bg-soft pl-3 pr-1 py-1">
            <span className="hidden sm:inline text-sm text-ink-muted">{user?.username}</span>
            <button
              onClick={salir}
              className="rounded-full p-1.5 text-ink-dim hover:text-error hover:bg-bg transition"
              title="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* SIDEBAR (desktop) */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-line bg-bg-card">
          <div className="p-4 border-b border-line">
            <div className="label mb-1">Establecimiento</div>
            <div className="font-display text-lg text-ink truncate">{campo.nombre}</div>
            <div className="mt-2 flex items-center gap-2">
              <RoleBadge rol={rol} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">{nav}</div>
          <div className="p-3 border-t border-line">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-muted hover:text-ink hover:bg-bg-soft w-full"
            >
              <ArrowLeft size={15} /> Mis campos
            </Link>
          </div>
        </aside>

        {/* CONTENIDO */}
        <main className="flex-1 min-w-0 px-4 sm:px-7 py-6 sm:py-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mx-auto max-w-5xl"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* DRAWER (mobile) */}
      <AnimatePresence>
        {navOpen && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="absolute left-0 top-0 h-full w-72 bg-bg-card border-r border-line flex flex-col"
            >
              <div className="p-4 border-b border-line flex items-start justify-between">
                <div className="min-w-0">
                  <div className="label mb-1">Establecimiento</div>
                  <div className="font-display text-lg text-ink truncate">{campo.nombre}</div>
                  <div className="mt-2">
                    <RoleBadge rol={rol} />
                  </div>
                </div>
                <button onClick={() => setNavOpen(false)} className="text-ink-dim hover:text-ink p-1">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">{nav}</div>
              <div className="p-3 border-t border-line">
                <Link
                  href="/dashboard"
                  onClick={() => setNavOpen(false)}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-muted hover:text-ink hover:bg-bg-soft w-full"
                >
                  <ArrowLeft size={15} /> Mis campos
                </Link>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="card p-10 text-center text-ink-muted">{children}</div>
    </div>
  );
}
