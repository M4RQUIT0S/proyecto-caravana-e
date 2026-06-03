"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ShieldCheck,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  KeyRound,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { puede } from "@/lib/permisos";
import { useOnline } from "@/lib/conectividad";
import { prepararDTe, documentosDe, type AnimalBloqueado } from "@/lib/dte";
import { registrosPendientes, sincronizar, logsDe, type ResultadoSync } from "@/lib/sync";
import { aptitud } from "@/lib/eventos";
import { esActivo, estado } from "@/lib/reglas";

export default function SenasaPage() {
  const { id } = useParams<{ id: string }>();
  const { db, user, refresh } = useApp();
  const online = useOnline();
  const rol = rolEnCampo(user!.id, id);
  const campo = db.campos.find((c) => c.id === id)!;

  if (!puede(rol, "senasa")) {
    return (
      <div className="card p-10 text-center text-ink-muted">
        Sólo el Productor gestiona la documentación y la sincronización con SENASA (RN21).
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!campo.renspa && (
        <div className="rounded-xl border border-amber-300/30 bg-amber-300/5 px-4 py-3 text-sm text-amber-200 flex items-center gap-2">
          <AlertTriangle size={16} />
          Cargá el RENSPA y el token del establecimiento en Catálogos: sin eso, SENASA rechaza los
          registros (RN15 / RN16).
        </div>
      )}
      <PrepararDTe campoId={id} onChange={refresh} />
      <Sincronizacion campoId={id} userId={user!.id} online={online} onChange={refresh} />
    </div>
  );
}

function PrepararDTe({ campoId, onChange }: { campoId: string; onChange: () => void }) {
  const { db } = useApp();
  const animales = useMemo(
    () =>
      db.animales.filter(
        (a) => a.campoId === campoId && esActivo(a) && estado(a) !== "egresado" && estado(a) !== "muerto"
      ),
    [db.animales, campoId]
  );
  const documentos = documentosDe(campoId, db.documentos);
  const [origen, setOrigen] = useState(db.campos.find((c) => c.id === campoId)?.nombre ?? "");
  const [destino, setDestino] = useState("");
  const [numero, setNumero] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [bloqueados, setBloqueados] = useState<AnimalBloqueado[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function toggle(aid: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(aid)) next.delete(aid);
      else next.add(aid);
      return next;
    });
  }

  function preparar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = prepararDTe(
      { campoId, animalIds: Array.from(seleccion), origen, destino, numeroDTe: numero },
      animales
    );
    if (!r.ok) {
      setBloqueados(r.bloqueados);
      setMsg({ ok: false, text: r.error });
      return;
    }
    setBloqueados([]);
    setSeleccion(new Set());
    setNumero("");
    setMsg({ ok: true, text: "DT-e preparado y agregado a la cola de sincronización (RU10)." });
    onChange();
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={18} className="text-accent" />
        <h3 className="font-display text-xl text-ink">Preparar DT-e (movimiento externo)</h3>
      </div>
      <p className="text-sm text-ink-muted">
        Se arma con datos ya cargados (RU10). Los animales en carencia se bloquean (RF-13 / RN03).
      </p>

      <form onSubmit={preparar} className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label block mb-1.5">Origen</label>
            <input className="input" value={origen} onChange={(e) => setOrigen(e.target.value)} />
          </div>
          <div>
            <label className="label block mb-1.5">Destino</label>
            <input
              className="input"
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Frigorífico / RENSPA destino"
            />
          </div>
          <div>
            <label className="label block mb-1.5">N° DT-e (opcional)</label>
            <input className="input" value={numero} onChange={(e) => setNumero(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label">Animales ({seleccion.size} seleccionados)</label>
          </div>
          <div className="max-h-56 overflow-auto rounded-xl border border-line">
            {animales.length === 0 ? (
              <div className="px-3 py-4 text-sm text-ink-dim text-center">No hay animales disponibles.</div>
            ) : (
              animales.map((a) => {
                const apt = aptitud(a);
                const sel = seleccion.has(a.id);
                const bloqueado = bloqueados.some((b) => b.animalId === a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-3 px-3 py-2 border-b border-line/50 last:border-0 cursor-pointer text-sm ${
                      bloqueado ? "bg-red-400/10" : sel ? "bg-accent/5" : "hover:bg-bg-soft/60"
                    }`}
                  >
                    <input type="checkbox" className="accent-accent" checked={sel} onChange={() => toggle(a.id)} />
                    <span className="font-mono text-accent">{a.caravana}</span>
                    <span
                      className={`ml-auto text-xs ${
                        apt.color === "verde" ? "text-emerald-300" : apt.color === "amber" ? "text-amber-300" : "text-red-300"
                      }`}
                    >
                      {apt.texto}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {bloqueados.length > 0 && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/5 p-3 text-sm">
            <div className="text-red-300 font-medium mb-1 flex items-center gap-1.5">
              <XCircle size={15} /> Bloqueados por carencia/estado (RF-13)
            </div>
            <ul className="text-red-200/90 text-xs space-y-0.5">
              {bloqueados.map((b) => (
                <li key={b.animalId}>
                  <span className="font-mono">{b.caravana}</span>: {b.motivo}
                </li>
              ))}
            </ul>
            <div className="text-xs text-ink-muted mt-1">Quitalos de la selección o esperá la fecha de fin de carencia.</div>
          </div>
        )}

        {msg && (
          <div className={`text-sm flex items-center gap-2 ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>
            {msg.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {msg.text}
          </div>
        )}
        <div className="flex justify-end">
          <button className="btn-primary text-sm">
            <FileText size={14} /> Preparar DT-e
          </button>
        </div>
      </form>

      {documentos.length > 0 && (
        <div className="pt-2">
          <div className="label mb-2">Documentos</div>
          <ul className="space-y-1.5">
            {documentos.slice(0, 6).map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm border-b border-line/50 pb-1.5 last:border-0">
                <span className="text-ink">
                  DT-e · {d.cantidadAnimales} animales → {d.destino}
                </span>
                <span className="chip text-[10px] uppercase">{d.estado}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Sincronizacion({
  campoId,
  userId,
  online,
  onChange,
}: {
  campoId: string;
  userId: string;
  online: boolean;
  onChange: () => void;
}) {
  const { db, refresh } = useApp();
  const campo = db.campos.find((c) => c.id === campoId)!;
  const pendientes = useMemo(() => registrosPendientes(campoId, db), [db, campoId]);
  const logs = useMemo(() => logsDe(campoId, db), [db, campoId]);
  const [res, setRes] = useState<ResultadoSync | null>(null);

  function sync() {
    const r = sincronizar(campoId, userId);
    setRes(r);
    refresh();
    onChange();
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-accent" />
          <h3 className="font-display text-xl text-ink">Sincronización con SENASA</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <KeyRound size={13} /> {campo.tokenSenasa ? "Token cargado" : "Sin token"}
        </span>
      </div>

      {!online && (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/5 px-3 py-2 text-xs text-amber-300">
          Sin conexión: la sincronización requiere señal. La cola se conserva intacta (RNF-08).
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-line bg-bg-soft/40 px-4 py-3">
        <div>
          <div className="font-display text-2xl text-amber-300 leading-none">{pendientes.length}</div>
          <div className="text-xs text-ink-muted">registros pendientes</div>
        </div>
        <button onClick={sync} disabled={!online || pendientes.length === 0} className="btn-primary text-sm disabled:opacity-40">
          <RefreshCw size={14} /> Sincronizar
        </button>
      </div>

      {pendientes.length > 0 && (
        <ul className="text-sm space-y-1.5">
          {pendientes.slice(0, 8).map((p) => (
            <li key={p.id} className="flex items-center justify-between border-b border-line/50 pb-1.5 last:border-0">
              <span className="text-ink-muted">{p.descripcion}</span>
              <span className="chip text-[10px] uppercase">{p.estado}</span>
            </li>
          ))}
        </ul>
      )}

      {res && (
        <div className="rounded-xl border border-line p-3 space-y-2">
          <div className="text-sm text-emerald-300 flex items-center gap-2">
            <CheckCircle2 size={15} /> {res.aceptados} aceptados
          </div>
          {res.rechazados.length > 0 && (
            <div>
              <div className="text-sm text-red-300 flex items-center gap-2 mb-1">
                <XCircle size={15} /> {res.rechazados.length} rechazados
              </div>
              <ul className="text-xs text-red-200/90 space-y-0.5">
                {res.rechazados.map((r) => (
                  <li key={r.id}>
                    {r.descripcion}: <span className="text-red-300">{r.motivo}</span>
                  </li>
                ))}
              </ul>
              <div className="text-xs text-ink-muted mt-1">
                Corregí el dato y reintentá: los rechazados siguen en cola (RNF-08).
              </div>
            </div>
          )}
          {res.error && <div className="text-xs text-amber-300">{res.error}</div>}
        </div>
      )}

      {logs.length > 0 && (
        <div>
          <div className="label mb-2">Log de sincronización (auditoría, RN10)</div>
          <ul className="text-xs space-y-1 max-h-40 overflow-auto">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between text-ink-dim">
                <span>
                  {new Date(l.fechaHora).toLocaleString()} · {l.tipoRegistro}
                </span>
                <span
                  className={
                    l.resultado === "aceptado"
                      ? "text-emerald-300"
                      : l.resultado === "rechazado"
                      ? "text-red-300"
                      : "text-amber-300"
                  }
                >
                  {l.resultado}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
