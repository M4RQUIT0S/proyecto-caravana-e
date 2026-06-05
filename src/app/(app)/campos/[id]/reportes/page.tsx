"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Plus,
  Trash2,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import {
  resumenRentabilidad,
  hallazgosPorProveedor,
  VALOR_KG_REFERENCIA,
  type FiltrosReporte,
} from "@/lib/reportes";
import {
  imputarCosto,
  eliminarCosto,
  costosDe,
  LABEL_COSTO,
} from "@/lib/costos";
import { proveedoresDe } from "@/lib/catalogos";
import { hoy } from "@/lib/eventos";
import { TonoBadge } from "@/components/Tono";
import type { TipoCosto } from "@/lib/types";

export default function ReportesPage() {
  const { id } = useParams<{ id: string }>();
  const { db, user, refresh } = useApp();
  const rol = rolEnCampo(user!.id, id);

  const lotes = useMemo(() => db.lotes.filter((l) => l.campoId === id), [db.lotes, id]);
  const proveedores = proveedoresDe(id, db.proveedores);

  const [filtros, setFiltros] = useState<FiltrosReporte>({});
  const resumen = useMemo(() => resumenRentabilidad(id, db, filtros), [db, id, filtros]);
  const hallazgos = useMemo(() => hallazgosPorProveedor(id, db), [db, id]);

  if (!puede(rol, "reportes")) {
    return (
      <div className="card p-10 text-center text-ink-muted">
        Los reportes de rentabilidad son exclusivos del Productor (RN21 / RU09).
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros (CU-09) */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <Filtro label="Lote">
          <select
            className="input"
            value={filtros.loteId ?? ""}
            onChange={(e) => setFiltros((f) => ({ ...f, loteId: e.target.value || undefined }))}
          >
            <option value="">Todos</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </Filtro>
        <Filtro label="Proveedor / origen">
          <select
            className="input"
            value={filtros.proveedorId ?? ""}
            onChange={(e) => setFiltros((f) => ({ ...f, proveedorId: e.target.value || undefined }))}
          >
            <option value="">Todos</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>{p.razonSocial}</option>
            ))}
          </select>
        </Filtro>
        <Filtro label="Desde">
          <input
            type="date"
            className="input"
            value={filtros.desde ?? ""}
            onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value || undefined }))}
          />
        </Filtro>
        <Filtro label="Hasta">
          <input
            type="date"
            className="input"
            value={filtros.hasta ?? ""}
            onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value || undefined }))}
          />
        </Filtro>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          icon={TrendingUp}
          label="ADPV promedio"
          value={resumen.adpvPromedio != null ? `${resumen.adpvPromedio} kg/d` : "—"}
        />
        <Kpi icon={DollarSign} label="Costo total" value={`$${miles(resumen.costoTotal)}`} />
        <Kpi icon={BarChart3} label="Kilos ganados" value={`${miles(resumen.kilosTotal)} kg`} />
        <Kpi
          icon={resumen.margenTotal >= 0 ? TrendingUp : TrendingDown}
          label="Margen estimado"
          value={`$${miles(resumen.margenTotal)}`}
          accent={resumen.margenTotal < 0 ? "rojo" : "verde"}
        />
      </div>
      <p className="text-xs text-ink-dim">
        Margen estimado con valor de referencia ${VALOR_KG_REFERENCIA}/kg (no es valuación contable, E-02).
      </p>

      {/* Cola de tropa */}
      {resumen.colaDeTropa.length > 0 && (
        <div className="card p-5 border-warning/30">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={18} className="text-warning" />
            <h3 className="font-display text-lg text-ink">Cola de tropa</h3>
            <TonoBadge tono="warning">{resumen.colaDeTropa.length}</TonoBadge>
          </div>
          <p className="text-sm text-ink-muted mb-3">
            Animales que comen pero casi no ganan peso (ADPV bajo). Candidatos a revisar para reposición.
          </p>
          <div className="flex flex-wrap gap-2">
            {resumen.colaDeTropa.map((f) => (
              <TonoBadge key={f.animalId} tono="warning">
                <span className="font-mono">{f.caravana}</span> · {f.adpv} kg/d
              </TonoBadge>
            ))}
          </div>
        </div>
      )}

      {/* Hallazgos por proveedor */}
      {hallazgos.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display text-lg text-ink mb-3">Hallazgos por proveedor / origen</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-ink-dim text-xs uppercase">
                <tr className="border-b border-line">
                  <th className="text-left py-2">Proveedor</th>
                  <th className="text-left">Zona</th>
                  <th className="text-right">Animales</th>
                  <th className="text-right">Mortandad</th>
                  <th className="text-right">Ev. sanitarios</th>
                  <th className="text-right">ADPV prom.</th>
                </tr>
              </thead>
              <tbody>
                {hallazgos.map((h) => (
                  <tr key={h.proveedorId} className="border-b border-line/50">
                    <td className="py-2 text-ink">{h.proveedor}</td>
                    <td className="text-ink-muted">{h.zonaOrigen ?? "—"}</td>
                    <td className="text-right text-ink-muted">{h.animales}</td>
                    <td className={`text-right ${h.tasaMortandad > 0 ? "text-error" : "text-ink-muted"}`}>
                      {h.tasaMortandad}%
                    </td>
                    <td className="text-right text-ink-muted">{h.eventosSanitarios}</td>
                    <td className="text-right text-ink-muted">
                      {h.adpvPromedio != null ? `${h.adpvPromedio}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalle por animal */}
      <div className="card p-5">
        <h3 className="font-display text-lg text-ink mb-3">Rentabilidad por animal</h3>
        {resumen.filas.length === 0 ? (
          <p className="text-sm text-ink-muted">No hay animales para los filtros elegidos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-ink-dim text-xs uppercase">
                <tr className="border-b border-line">
                  <th className="text-left py-2">Caravana</th>
                  <th className="text-left">Lote</th>
                  <th className="text-right">Peso</th>
                  <th className="text-right">Kg ganados</th>
                  <th className="text-right">ADPV</th>
                  <th className="text-right">Costo</th>
                  <th className="text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {resumen.filas.map((f) => (
                  <tr key={f.animalId} className={`border-b border-line/50 ${f.colaDeTropa ? "bg-warning/5" : ""}`}>
                    <td className="py-2 font-mono text-accent">{f.caravana}</td>
                    <td className="text-ink-muted">{f.loteNombre ?? "—"}</td>
                    <td className="text-right text-ink-muted">{f.pesoActual ?? "—"}</td>
                    <td className="text-right text-ink-muted">{f.kilosGanados}</td>
                    <td className="text-right text-ink-muted">{f.adpv ?? "—"}</td>
                    <td className="text-right text-ink-muted">${miles(f.costoTotal)}</td>
                    <td className={`text-right ${f.margen < 0 ? "text-error" : "text-success"}`}>
                      ${miles(f.margen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Imputar costos */}
      <Costos campoId={id} onChange={refresh} />
    </div>
  );
}

function Costos({ campoId, onChange }: { campoId: string; onChange: () => void }) {
  const { db, refresh } = useApp();
  const lotes = db.lotes.filter((l) => l.campoId === campoId);
  const proveedores = proveedoresDe(campoId, db.proveedores);
  const costos = costosDe(campoId, db.costos).slice(0, 10);
  const [form, setForm] = useState({
    tipoCosto: "alimentacion" as TipoCosto,
    monto: "",
    loteId: "",
    fecha: hoy(),
    descripcion: "",
    proveedorId: "",
  });

  function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.monto || Number(form.monto) <= 0) return;
    imputarCosto({
      campoId,
      loteId: form.loteId || undefined,
      tipoCosto: form.tipoCosto,
      monto: Number(form.monto),
      fecha: form.fecha,
      descripcion: form.descripcion.trim() || undefined,
      proveedorId: form.proveedorId || undefined,
    });
    setForm({ ...form, monto: "", descripcion: "" });
    refresh();
    onChange();
  }

  return (
    <div className="card p-5">
      <h3 className="font-display text-lg text-ink mb-3">Imputar costos</h3>
      <form onSubmit={agregar} className="grid sm:grid-cols-[1fr_1fr_1fr_1.4fr_auto] gap-2 items-end">
        <Filtro label="Tipo">
          <select
            className="input"
            value={form.tipoCosto}
            onChange={(e) => setForm({ ...form, tipoCosto: e.target.value as TipoCosto })}
          >
            {Object.entries(LABEL_COSTO).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Filtro>
        <Filtro label="Monto ($)">
          <input
            className="input"
            type="number"
            value={form.monto}
            onChange={(e) => setForm({ ...form, monto: e.target.value })}
          />
        </Filtro>
        <Filtro label="Lote">
          <select
            className="input"
            value={form.loteId}
            onChange={(e) => setForm({ ...form, loteId: e.target.value })}
          >
            <option value="">General</option>
            {lotes.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </Filtro>
        <Filtro label="Descripción">
          <input
            className="input"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </Filtro>
        <button className="btn-primary text-sm h-[42px]">
          <Plus size={14} /> Imputar
        </button>
      </form>

      {costos.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {costos.map((c) => {
            const lote = lotes.find((l) => l.id === c.loteId);
            return (
              <li key={c.id} className="flex items-center justify-between text-sm border-b border-line/50 pb-1.5 last:border-0">
                <span className="text-ink-muted">
                  {LABEL_COSTO[c.tipoCosto]} · ${miles(c.monto)}
                  {lote ? ` · ${lote.nombre}` : ""} {c.descripcion ? `· ${c.descripcion}` : ""}
                </span>
                <button
                  onClick={() => {
                    eliminarCosto(c.id);
                    refresh();
                    onChange();
                  }}
                  className="text-ink-dim hover:text-error"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: "verde" | "rojo";
}) {
  return (
    <div className="card p-4">
      <Icon
        size={16}
        className={accent === "rojo" ? "text-error" : accent === "verde" ? "text-success" : "text-accent"}
      />
      <div className="font-display text-2xl text-ink mt-2 leading-none">{value}</div>
      <div className="text-xs text-ink-muted mt-1">{label}</div>
    </div>
  );
}

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function miles(n: number): string {
  return n.toLocaleString("es-AR");
}
