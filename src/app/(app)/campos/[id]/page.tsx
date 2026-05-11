"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Layers, Tags, Users, BellRing, Copy } from "lucide-react";
import { useApp } from "@/lib/context";

export default function CampoResumen() {
  const { id } = useParams<{ id: string }>();
  const { db } = useApp();
  const campo = db.campos.find((c) => c.id === id)!;
  const lotes = db.lotes.filter((l) => l.campoId === id);
  const animales = db.animales.filter((a) => a.campoId === id);
  const alertasActivas = useMemo(
    () =>
      animales.reduce(
        (acc, a) => acc + a.alertas.filter((al) => !al.resuelta).length,
        0
      ),
    [animales]
  );
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

  function copiarCodigo() {
    navigator.clipboard.writeText(campo.codigo);
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Layers} label="Lotes" value={lotes.length} href={`/campos/${id}/lotes`} />
        <Stat icon={Tags} label="Animales" value={animales.length} href={`/campos/${id}/animales`} />
        <Stat icon={Users} label="Miembros" value={miembros} href={`/campos/${id}/usuarios`} />
        <Stat icon={BellRing} label="Alertas activas" value={alertasActivas} accent />
      </div>

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
            <Copy size={14} /> Copiar
          </button>
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  href,
  accent,
}: {
  icon: any;
  label: string;
  value: number;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <motion.div
      whileHover={{ y: -2 }}
      className={`card p-4 transition ${
        accent ? "border-accent/40" : "hover:border-accent/30"
      }`}
    >
      <div className="flex items-center justify-between text-ink-dim">
        <Icon size={16} className={accent ? "text-accent" : ""} />
      </div>
      <div className="font-display text-3xl text-ink mt-2 leading-none">{value}</div>
      <div className="text-xs text-ink-muted mt-1">{label}</div>
    </motion.div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
