"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Syringe, AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { puede, permisosDe } from "@/lib/permisos";
import { catalogosDe, productosDe } from "@/lib/catalogos";
import { registrarSanitario, hoy } from "@/lib/eventos";
import { calcularFinCarencia } from "@/lib/reglas";
import { useOnline } from "@/lib/conectividad";
import { AnimalSelect } from "@/components/AnimalSelect";
import { TonoBadge } from "@/components/Tono";
import type { EventoSanitario } from "@/lib/types";

export default function SanidadPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { db, user, refresh } = useApp();
  const online = useOnline();
  const campo = db.campos.find((c) => c.id === id)!;
  const miembro = campo.miembros.find((m) => m.userId === user!.id);
  const rol = rolEnCampo(user!.id, id);
  const habilitado = puede(rol, "sanidad", permisosDe(miembro));

  const animales = useMemo(() => db.animales.filter((a) => a.campoId === id), [db.animales, id]);
  const lotes = useMemo(() => db.lotes.filter((l) => l.campoId === id), [db.lotes, id]);
  const catalogos = catalogosDe(id, db.catalogos, "sanitario");
  const productos = productosDe(id, db.productos);

  const [modo, setModo] = useState<"individual" | "lote">("individual");
  const [animalId, setAnimalId] = useState<string | undefined>(sp.get("animal") ?? undefined);
  const [loteId, setLoteId] = useState("");
  const [catalogoId, setCatalogoId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [dosis, setDosis] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [responsable, setResponsable] = useState("");
  const [observacion, setObservacion] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const producto = productos.find((p) => p.id === productoId);
  const finCarencia = producto?.diasCarencia
    ? calcularFinCarencia(fecha, producto.diasCarencia)
    : undefined;

  const eventosSanitarios = useMemo(
    () =>
      db.eventos
        .filter((e): e is EventoSanitario => e.tipo === "sanitario" && e.campoId === id && e.activo !== false)
        .sort((a, b) => b.fechaHora - a.fechaHora)
        .slice(0, 8),
    [db.eventos, id]
  );

  if (!habilitado) {
    return (
      <div className="card p-10 text-center text-ink-muted">
        Tu rol no tiene permiso para registrar eventos sanitarios.
      </div>
    );
  }

  function registrar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const afectados =
      modo === "lote" && loteId
        ? animales.filter((a) => a.loteId === loteId).map((a) => a.id)
        : undefined;
    const protagonista = modo === "lote" ? afectados?.[0] : animalId;
    if (!protagonista) {
      setMsg({ ok: false, text: modo === "lote" ? "El lote no tiene animales." : "Seleccioná un animal." });
      return;
    }
    const r = registrarSanitario(
      {
        campoId: id,
        animalId: protagonista,
        usuarioId: user!.id,
        catalogoId: catalogoId || undefined,
        productoId: productoId || undefined,
        dosis: dosis ? Number(dosis) : undefined,
        responsable: responsable.trim() || undefined,
        fecha,
        observacion: observacion.trim() || undefined,
        online,
        animalesAfectados: afectados,
      },
      animales,
      productos
    );
    if (!r.ok) {
      setMsg({ ok: false, text: r.error });
      return;
    }
    const n = afectados?.length ?? 1;
    setMsg({
      ok: true,
      text: finCarencia
        ? `Evento registrado en ${n} animal(es). Carencia hasta ${finCarencia} (faena bloqueada).`
        : `Evento registrado en ${n} animal(es). Sin carencia.`,
    });
    setProductoId("");
    setDosis("");
    setObservacion("");
    refresh();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <form onSubmit={registrar} className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Syringe size={18} className="text-accent" />
          <h3 className="font-heading text-base text-ink">Registrar evento sanitario</h3>
        </div>
        {!online && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            Sin conexión: el evento se guarda local y se sincroniza después.
          </div>
        )}

        <div className="flex gap-2">
          <ModoBtn activo={modo === "individual"} onClick={() => setModo("individual")} icon={Syringe}>
            Individual
          </ModoBtn>
          <ModoBtn activo={modo === "lote"} onClick={() => setModo("lote")} icon={Users}>
            Lote completo
          </ModoBtn>
        </div>

        {modo === "individual" ? (
          <div>
            <label className="label block mb-1.5">Animal</label>
            <AnimalSelect animales={animales} value={animalId} onChange={setAnimalId} />
          </div>
        ) : (
          <div>
            <label className="label block mb-1.5">Lote</label>
            <select className="input" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
              <option value="">Elegí un lote…</option>
              {lotes.map((l) => {
                const n = animales.filter((a) => a.loteId === l.id).length;
                return (
                  <option key={l.id} value={l.id}>
                    {l.nombre} ({n} animales)
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1.5">Tipo de evento (catálogo)</label>
            <select className="input" value={catalogoId} onChange={(e) => setCatalogoId(e.target.value)}>
              <option value="">Elegí del catálogo…</option>
              {catalogos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} · {c.descripcion}
                </option>
              ))}
            </select>
            {catalogos.length === 0 && (
              <div className="text-[11px] text-warning mt-1">
                No hay eventos sanitarios en el catálogo. Cargalos en Catálogos.
              </div>
            )}
          </div>
          <div>
            <label className="label block mb-1.5">Producto sanitario</label>
            <select className="input" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
              <option value="">Sin producto</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombreComercial} ({p.diasCarencia}d carencia)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">
              Dosis {producto?.unidadMedida ? `(${producto.unidadMedida})` : ""}
            </label>
            <input
              className="input"
              type="number"
              step="any"
              value={dosis}
              onChange={(e) => setDosis(e.target.value)}
            />
          </div>
          <div>
            <label className="label block mb-1.5">Fecha</label>
            <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="label block mb-1.5">Responsable (veterinario)</label>
            <input
              className="input"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="Nombre del veterinario"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Observación</label>
            <input className="input" value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          </div>
        </div>

        {producto && (
          <div
            className={`rounded-xl border px-3 py-2.5 text-sm flex items-center gap-2 ${
              finCarencia
                ? "border-warning/30 bg-warning/5 text-warning"
                : "border-success/30 bg-success/5 text-success"
            }`}
          >
            <AlertTriangle size={15} />
            {finCarencia
              ? `Carencia de ${producto.diasCarencia} días → el animal no podrá ir a faena/movimiento hasta el ${finCarencia}.`
              : "Producto sin período de carencia (0 días)."}
          </div>
        )}

        {msg && (
          <div className={`text-sm flex items-center gap-2 ${msg.ok ? "text-success" : "text-error"}`}>
            {msg.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {msg.text}
          </div>
        )}
        <div className="flex justify-end">
          <button className="btn-primary text-sm">
            <Syringe size={14} /> Registrar evento
          </button>
        </div>
      </form>

      <div className="card p-5">
        <h4 className="font-heading text-base text-ink mb-3">Últimos eventos</h4>
        {eventosSanitarios.length === 0 ? (
          <p className="text-sm text-ink-muted">Todavía no hay eventos sanitarios.</p>
        ) : (
          <ul className="space-y-3">
            {eventosSanitarios.map((e) => {
              const a = db.animales.find((x) => x.id === e.animalId);
              return (
                <li key={e.id} className="text-sm border-b border-line/50 pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-ink">
                      {e.productoNombre || "Evento"}{" "}
                      <span className="font-mono text-accent text-xs">{a?.caravana}</span>
                      {e.animalesAfectados && e.animalesAfectados.length > 1 && (
                        <span className="text-ink-dim text-xs"> +{e.animalesAfectados.length - 1}</span>
                      )}
                    </div>
                    {e.fechaFinCarencia && <TonoBadge tono="warning">Carencia</TonoBadge>}
                  </div>
                  <div className="text-ink-dim text-xs">
                    {e.fecha}
                    {e.fechaFinCarencia ? ` · hasta ${e.fechaFinCarencia}` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ModoBtn({
  activo,
  onClick,
  icon: Icon,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
        activo ? "border-accent/50 bg-accent/10 text-ink" : "border-line text-ink-muted hover:text-ink"
      }`}
    >
      <Icon size={14} /> {children}
    </button>
  );
}
