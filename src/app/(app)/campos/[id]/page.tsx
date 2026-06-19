"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Layers, Tags, Users, BellRing, Copy, Bot, Clock, RefreshCw, TrendingUp, LayoutDashboard, ScanLine, Upload, Check } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useApp } from "@/lib/context";
import { totalPendientes } from "@/lib/sigsa";
import { contarPendientes, esActivo, estaEnCarencia } from "@/lib/reglas";
import { resumenRentabilidad } from "@/lib/reportes";

export default function CampoResumen() {
  const { id } = useParams<{ id: string }>();
  const { db } = useApp();
  const campo = db.campos.find((c) => c.id === id)!;
  const lotes = db.lotes.filter((l) => l.campoId === id);
  const animales = db.animales.filter((a) => a.campoId === id && esActivo(a));
  const enCarencia = useMemo(() => animales.filter((a) => estaEnCarencia(a)).length, [animales]);
  const enCola = useMemo(
    () => contarPendientes(db.eventos.filter((e) => e.campoId === id)),
    [db.eventos, id]
  );
  const adpvProm = useMemo(
    () => resumenRentabilidad(id, db).adpvPromedio,
    [db, id]
  );
  const alertasActivas = useMemo(
    () =>
      animales.reduce(
        (acc, a) => acc + a.alertas.filter((al) => !al.resuelta).length,
        0
      ),
    [animales]
  );
  const sigsaPendientes = useMemo(() => totalPendientes(animales), [animales]);
  const miembros = campo.miembros.length + 1;

  const rangos = useMemo(() => {
    // "rangos" = distribución por categoría (rango de tipo de animales)
    const m = new Map<string, number>();
    for (const a of animales) {
      const k = a.categoria?.trim() || "Sin categoría";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [animales]);

  const [copiado, setCopiado] = useState(false);
  function copiarCodigo() {
    navigator.clipboard.writeText(campo.codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        icon={LayoutDashboard}
        eyebrow="Resumen del campo"
        title={campo.nombre}
        subtitle="Un vistazo rápido a tu rodeo. Tocá cualquier tarjeta para ver el detalle de esa sección."
        actions={
          <>
            <Link href={`/campos/${id}/importar`} className="btn-ghost text-sm">
              <Upload size={15} /> Cargar animales
            </Link>
            <Link href={`/campos/${id}/manga`} className="btn-primary text-sm">
              <ScanLine size={15} /> Capturar en manga
            </Link>
          </>
        }
      />

      <section>
        <h2 className="label mb-3">Estado del rodeo</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Stat icon={Tags} label="Animales" value={animales.length} href={`/campos/${id}/animales`} />
        <Stat icon={Layers} label="Lotes" value={lotes.length} href={`/campos/${id}/lotes`} />
        <Stat
          icon={Clock}
          label="En carencia"
          value={enCarencia}
          href={`/campos/${id}/animales`}
          tono={enCarencia > 0 ? "warning" : undefined}
        />
        <Stat
          icon={RefreshCw}
          label="En cola (sync)"
          value={enCola}
          href={`/campos/${id}/senasa`}
          tono={enCola > 0 ? "info" : undefined}
        />
        <Stat
          icon={TrendingUp}
          label="ADPV promedio"
          value={adpvProm != null ? adpvProm : 0}
          href={`/campos/${id}/reportes`}
          tono={adpvProm != null && adpvProm > 0 ? "success" : undefined}
        />
        <Stat icon={Users} label="Miembros" value={miembros} href={`/campos/${id}/usuarios`} />
        <Stat
          icon={BellRing}
          label="Alertas activas"
          value={alertasActivas}
          tono={alertasActivas > 0 ? "error" : undefined}
        />
        <Stat
          icon={Bot}
          label="Pendientes SIGSA"
          value={sigsaPendientes}
          href={`/campos/${id}/sigsa`}
          tono={sigsaPendientes > 0 ? "warning" : undefined}
        />
      </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-ink">Rangos del campo</h3>
          <Link
            href={`/campos/${id}/animales`}
            className="text-sm text-ink-muted hover:text-ink"
          >
            Ver detalle →
          </Link>
        </div>
        {rangos.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Todavía no hay animales cargados. Importá un CSV o agregá uno manualmente para ver los rangos por categoría.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {rangos.map(([cat, n], idx) => {
              const total = animales.length;
              const pct = Math.round((n / total) * 100);
              return (
                <motion.li
                  key={cat}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-ink">{cat}</span>
                    <span className="text-ink-muted">
                      {n} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg-soft overflow-hidden">
                    <motion.div
                      className="h-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, delay: idx * 0.04 }}
                    />
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h3 className="font-display text-xl text-ink mb-2">Código de invitación</h3>
        <p className="text-sm text-ink-muted">
          Compartí este código con quien quieras agregar al campo. Cualquier usuario
          registrado puede usarlo desde su dashboard.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <code className="rounded-xl border border-line bg-bg-soft px-4 py-2.5 font-mono tracking-[0.4em] text-lg uppercase">
            {campo.codigo}
          </code>
          <button onClick={copiarCodigo} className="btn-ghost text-sm">
            {copiado ? (
              <>
                <Check size={14} className="text-success" /> Copiado
              </>
            ) : (
              <>
                <Copy size={14} /> Copiar
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

type Tono = "success" | "warning" | "error" | "info";

const TONO: Record<Tono, { border: string; icon: string; dot: string }> = {
  success: { border: "border-success/40", icon: "text-success", dot: "bg-success" },
  warning: { border: "border-warning/40", icon: "text-warning", dot: "bg-warning" },
  error: { border: "border-error/40", icon: "text-error", dot: "bg-error" },
  info: { border: "border-info/40", icon: "text-info", dot: "bg-info" },
};

function Stat({
  icon: Icon,
  label,
  value,
  href,
  tono,
}: {
  icon: any;
  label: string;
  value: number;
  href?: string;
  tono?: Tono;
}) {
  const t = tono ? TONO[tono] : null;
  const inner = (
    <motion.div
      whileHover={{ y: -2 }}
      className={`card p-4 transition ${t ? t.border : "hover:border-accent/30"}`}
    >
      <div className="flex items-center justify-between text-ink-dim">
        <Icon size={16} className={t ? t.icon : ""} />
        {t && <span className={`h-2 w-2 rounded-full ${t.dot}`} aria-hidden />}
      </div>
      <div className="font-display text-3xl text-ink mt-2 leading-none">{value}</div>
      <div className="text-xs text-ink-muted mt-1">{label}</div>
    </motion.div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
