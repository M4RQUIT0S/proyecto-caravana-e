"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRightLeft, AlertTriangle, CheckCircle2, Truck, Home } from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { puede, permisosDe, esProductor } from "@/lib/permisos";
import { registrarMovimiento, hoy } from "@/lib/eventos";
import { aptitud } from "@/lib/eventos";
import { esActivo, estado } from "@/lib/reglas";
import { useOnline } from "@/lib/conectividad";
import { TonoBadge } from "@/components/Tono";
import type { Movimiento } from "@/lib/types";

export default function MovimientosPage() {
  const { id } = useParams<{ id: string }>();
  const { db, user, refresh } = useApp();
  const online = useOnline();
  const campo = db.campos.find((c) => c.id === id)!;
  const miembro = campo.miembros.find((m) => m.userId === user!.id);
  const rol = rolEnCampo(user!.id, id);
  const habilitado = puede(rol, "movimiento", permisosDe(miembro));
  const productor = esProductor(rol);

  const lotes = useMemo(() => db.lotes.filter((l) => l.campoId === id), [db.lotes, id]);
  const animales = useMemo(
    () =>
      db.animales.filter(
        (a) => a.campoId === id && esActivo(a) && estado(a) !== "muerto" && estado(a) !== "egresado"
      ),
    [db.animales, id]
  );

  const [subtipo, setSubtipo] = useState<"interno" | "externo">("interno");
  const [motivo, setMotivo] = useState("Cambio de potrero");
  const [loteOrigenId, setLoteOrigenId] = useState("");
  const [loteDestinoId, setLoteDestinoId] = useState("");
  const [destinoExterno, setDestinoExterno] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const candidatos = useMemo(
    () => (loteOrigenId ? animales.filter((a) => a.loteId === loteOrigenId) : animales),
    [animales, loteOrigenId]
  );

  const ultimosMovs = useMemo(
    () =>
      db.eventos
        .filter((e): e is Movimiento => e.tipo === "movimiento" && e.campoId === id && e.activo !== false)
        .sort((a, b) => b.fechaHora - a.fechaHora)
        .slice(0, 8),
    [db.eventos, id]
  );

  if (!habilitado) {
    return (
      <div className="card p-10 text-center text-ink-muted">
        Tu rol no tiene permiso para registrar movimientos.
      </div>
    );
  }

  function toggle(aid: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(aid)) next.delete(aid);
      else next.add(aid);
      return next;
    });
  }

  function registrar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const ids = Array.from(seleccion);
    if (ids.length === 0) {
      setMsg({ ok: false, text: "Seleccioná al menos un animal." });
      return;
    }
    const r = registrarMovimiento(
      {
        campoId: id,
        usuarioId: user!.id,
        subtipo,
        motivo: motivo.trim() || (subtipo === "interno" ? "Movimiento interno" : "Movimiento externo"),
        loteOrigenId: loteOrigenId || undefined,
        loteDestinoId: subtipo === "interno" ? loteDestinoId || undefined : undefined,
        destinoExterno: subtipo === "externo" ? destinoExterno.trim() || undefined : undefined,
        fecha,
        animalIds: ids,
        esProductor: productor,
        online,
      },
      db.animales.filter((a) => a.campoId === id)
    );
    if (!r.ok) {
      setMsg({ ok: false, text: r.error });
      return;
    }
    const externo = subtipo === "externo" && !/muert/i.test(motivo);
    setMsg({
      ok: true,
      text: externo
        ? `Movimiento externo registrado para ${ids.length} animal(es). Prepará el DT-e en SENASA.`
        : `Movimiento registrado para ${ids.length} animal(es).`,
    });
    setSeleccion(new Set());
    refresh();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6">
      <form onSubmit={registrar} className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft size={18} className="text-accent" />
          <h3 className="font-heading text-base text-ink">Registrar movimiento</h3>
        </div>

        <div className="flex gap-2">
          <ModoBtn activo={subtipo === "interno"} onClick={() => { setSubtipo("interno"); setMotivo("Cambio de potrero"); }} icon={Home}>
            Interno
          </ModoBtn>
          <ModoBtn activo={subtipo === "externo"} onClick={() => { setSubtipo("externo"); setMotivo("Venta"); }} icon={Truck}>
            Externo
          </ModoBtn>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1.5">Motivo</label>
            {subtipo === "interno" ? (
              <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            ) : (
              <select className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option>Venta</option>
                <option>Traslado</option>
                <option>Compra</option>
                <option>Muerte</option>
              </select>
            )}
          </div>
          <div>
            <label className="label block mb-1.5">Fecha</label>
            <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label className="label block mb-1.5">Lote origen</label>
            <select className="input" value={loteOrigenId} onChange={(e) => { setLoteOrigenId(e.target.value); setSeleccion(new Set()); }}>
              <option value="">Todos</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
          {subtipo === "interno" ? (
            <div>
              <label className="label block mb-1.5">Lote destino</label>
              <select className="input" value={loteDestinoId} onChange={(e) => setLoteDestinoId(e.target.value)}>
                <option value="">Sin lote</option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="label block mb-1.5">Destino externo</label>
              <input
                className="input"
                value={destinoExterno}
                onChange={(e) => setDestinoExterno(e.target.value)}
                placeholder="Frigorífico, comprador, RENSPA destino…"
              />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label">Animales ({seleccion.size} seleccionados)</label>
            <button
              type="button"
              className="text-xs text-accent hover:underline"
              onClick={() =>
                setSeleccion(
                  seleccion.size === candidatos.length ? new Set() : new Set(candidatos.map((a) => a.id))
                )
              }
            >
              {seleccion.size === candidatos.length ? "Quitar todos" : "Seleccionar todos"}
            </button>
          </div>
          <div className="max-h-64 overflow-auto rounded-xl border border-line">
            {candidatos.length === 0 ? (
              <div className="px-3 py-4 text-sm text-ink-dim text-center">No hay animales en este origen.</div>
            ) : (
              candidatos.map((a) => {
                const apt = aptitud(a);
                const sel = seleccion.has(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-3 px-3 py-2 border-b border-line/50 last:border-0 cursor-pointer text-sm ${
                      sel ? "bg-accent/5" : "hover:bg-bg-soft/60"
                    }`}
                  >
                    <input type="checkbox" className="accent-accent" checked={sel} onChange={() => toggle(a.id)} />
                    <span className="font-mono text-accent">{a.caravana}</span>
                    <span className="text-ink-muted">{a.categoria || ""}</span>
                    <span
                      className={`ml-auto text-xs ${
                        apt.color === "verde" ? "text-success" : apt.color === "amber" ? "text-warning" : "text-error"
                      }`}
                    >
                      {apt.texto}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {subtipo === "externo" && (
            <p className="text-[11px] text-ink-dim mt-1">
              Los animales en carencia se bloquean para movimiento externo/faena, salvo
              autorización del Productor para movimientos no-faena.
            </p>
          )}
        </div>

        {msg && (
          <div className={`text-sm flex items-center gap-2 ${msg.ok ? "text-success" : "text-error"}`}>
            {msg.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {msg.text}
          </div>
        )}
        <div className="flex justify-end">
          <button className="btn-primary text-sm">
            <ArrowRightLeft size={14} /> Registrar movimiento
          </button>
        </div>
      </form>

      <div className="card p-5">
        <h4 className="font-heading text-base text-ink mb-3">Últimos movimientos</h4>
        {ultimosMovs.length === 0 ? (
          <p className="text-sm text-ink-muted">Todavía no hay movimientos.</p>
        ) : (
          <ul className="space-y-3">
            {ultimosMovs.map((e) => (
              <li key={e.id} className="text-sm border-b border-line/50 pb-2 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-ink capitalize">
                    {e.subtipo} · {e.motivo}
                    {e.animalesAfectados && (
                      <span className="text-ink-dim text-xs"> ({e.animalesAfectados.length} animales)</span>
                    )}
                  </div>
                  {e.requiereDTe && <TonoBadge tono="warning">DT-e</TonoBadge>}
                </div>
                <div className="text-ink-dim text-xs">{e.fecha}</div>
              </li>
            ))}
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
