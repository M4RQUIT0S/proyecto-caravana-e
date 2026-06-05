"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Scale, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { puede, permisosDe } from "@/lib/permisos";
import { registrarPesaje, ultimoPesaje, hoy } from "@/lib/eventos";
import { calcularADPV, diasEntre, pesoFueraDeRango, rangoPesoCategoria } from "@/lib/reglas";
import { useOnline } from "@/lib/conectividad";
import { AnimalSelect } from "@/components/AnimalSelect";
import { TonoBadge } from "@/components/Tono";
import type { Pesaje } from "@/lib/types";

export default function PesajesPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { db, user, refresh } = useApp();
  const online = useOnline();
  const campo = db.campos.find((c) => c.id === id)!;
  const miembro = campo.miembros.find((m) => m.userId === user!.id);
  const rol = rolEnCampo(user!.id, id);
  const habilitado = puede(rol, "pesaje", permisosDe(miembro));

  const animales = useMemo(() => db.animales.filter((a) => a.campoId === id), [db.animales, id]);
  const [animalId, setAnimalId] = useState<string | undefined>(sp.get("animal") ?? undefined);
  const [peso, setPeso] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pedirConfirmacion, setPedirConfirmacion] = useState(false);

  const animal = animales.find((a) => a.id === animalId);
  const previo = animalId ? ultimoPesaje(animalId, db.eventos) : undefined;
  const rango = rangoPesoCategoria(animal?.categoria);

  const adpvPreview = useMemo(() => {
    if (!previo?.fecha || !peso) return undefined;
    const d = diasEntre(previo.fecha, fecha);
    return calcularADPV(Number(peso), previo.pesoKg, d);
  }, [previo, peso, fecha]);

  const fuera = peso ? pesoFueraDeRango(Number(peso), animal?.categoria) : false;

  const ultimosPesajes = useMemo(
    () =>
      db.eventos
        .filter((e): e is Pesaje => e.tipo === "pesaje" && e.campoId === id && e.activo !== false)
        .sort((a, b) => b.fechaHora - a.fechaHora)
        .slice(0, 8),
    [db.eventos, id]
  );

  if (!habilitado) {
    return (
      <div className="card p-10 text-center text-ink-muted">
        Tu rol no tiene permiso para registrar pesajes.
      </div>
    );
  }

  function registrar(e: React.FormEvent, confirmar = false) {
    e.preventDefault();
    setMsg(null);
    if (!animalId) {
      setMsg({ ok: false, text: "Seleccioná un animal." });
      return;
    }
    const r = registrarPesaje(
      {
        campoId: id,
        animalId,
        usuarioId: user!.id,
        pesoKg: Number(peso),
        fecha,
        online,
        confirmarFueraDeRango: confirmar,
      },
      animales,
      db.eventos
    );
    if (!r.ok) {
      if (r.error === "FUERA_DE_RANGO") {
        setPedirConfirmacion(true);
        return;
      }
      setMsg({ ok: false, text: r.error });
      return;
    }
    setPedirConfirmacion(false);
    setMsg({
      ok: true,
      text:
        adpvPreview != null
          ? `Pesaje registrado. ADPV ${adpvPreview} kg/día (RN13).`
          : "Pesaje registrado (primer pesaje del animal).",
    });
    setPeso("");
    refresh();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <form onSubmit={(e) => registrar(e)} className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Scale size={18} className="text-accent" />
          <h3 className="font-display text-xl text-ink">Registrar pesaje</h3>
        </div>
        {!online && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            Sin conexión: el pesaje se guarda local y sincroniza después (RNF-01).
          </div>
        )}

        <div>
          <label className="label block mb-1.5">Animal</label>
          <AnimalSelect animales={animales} value={animalId} onChange={(v) => { setAnimalId(v); setPedirConfirmacion(false); setMsg(null); }} />
        </div>

        {animal && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-bg-soft/40 p-3 text-sm">
            <Dato label="Categoría" valor={animal.categoria || "—"} />
            <Dato
              label="Rango válido"
              valor={rango ? `${rango[0]}–${rango[1]} kg` : "sin rango definido"}
            />
            <Dato
              label="Pesaje anterior"
              valor={previo ? `${previo.pesoKg} kg (${previo.fecha})` : "—"}
            />
            <Dato label="Estado" valor={animal.estado ?? "activo"} />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1.5">Peso (kg)</label>
            <input
              className="input"
              type="number"
              step="any"
              value={peso}
              onChange={(e) => {
                setPeso(e.target.value);
                setPedirConfirmacion(false);
              }}
              placeholder="balanza o carga manual"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Fecha</label>
            <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </div>

        {adpvPreview != null && (
          <div className="rounded-xl border border-info/30 bg-info/5 px-3 py-2.5 text-sm text-info flex items-center gap-2">
            <TrendingUp size={15} />
            ADPV estimado: {adpvPreview} kg/día respecto al pesaje anterior (RN13).
          </div>
        )}

        {fuera && peso && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-warning flex items-center gap-2">
            <AlertTriangle size={15} />
            Peso fuera del rango esperado para la categoría (RN08). Verificá antes de confirmar.
          </div>
        )}

        {msg && (
          <div className={`text-sm flex items-center gap-2 ${msg.ok ? "text-success" : "text-error"}`}>
            {msg.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {msg.text}
          </div>
        )}

        {pedirConfirmacion ? (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-warning mr-auto">Peso fuera de rango. ¿Confirmás?</span>
            <button type="button" onClick={() => setPedirConfirmacion(false)} className="btn-ghost text-sm">
              Revisar
            </button>
            <button type="button" onClick={(e) => registrar(e as any, true)} className="btn-primary text-sm">
              Confirmar igual
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button className="btn-primary text-sm">
              <Scale size={14} /> Registrar pesaje
            </button>
          </div>
        )}
      </form>

      <div className="card p-5">
        <h4 className="font-display text-lg text-ink mb-3">Últimos pesajes</h4>
        {ultimosPesajes.length === 0 ? (
          <p className="text-sm text-ink-muted">Todavía no hay pesajes.</p>
        ) : (
          <ul className="space-y-3">
            {ultimosPesajes.map((e) => {
              const a = db.animales.find((x) => x.id === e.animalId);
              return (
                <li key={e.id} className="text-sm border-b border-line/50 pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-ink">
                      {e.pesoKg} kg <span className="font-mono text-accent text-xs">{a?.caravana}</span>
                    </div>
                    {e.fueraDeRango && <TonoBadge tono="warning">Fuera de rango</TonoBadge>}
                  </div>
                  <div className="text-ink-dim text-xs">
                    {e.fecha}
                    {e.adpv != null ? ` · ADPV ${e.adpv} kg/día` : ""}
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

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="label mb-0.5">{label}</div>
      <div className="text-ink">{valor}</div>
    </div>
  );
}
