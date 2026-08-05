"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ScanLine,
  WifiOff,
  Wifi,
  Bluetooth,
  Syringe,
  Scale,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { puede, permisosDe } from "@/lib/permisos";
import { useOnline } from "@/lib/conectividad";
import { registrarLectura, aptitud } from "@/lib/eventos";
import { contarPendientes, esActivo, estado, validarFormatoCII } from "@/lib/reglas";
import {
  bluetoothDisponible,
  conectarLectorRFID,
  type BluetoothSesion,
} from "@/lib/bluetooth";
import type { Animal } from "@/lib/types";

export default function MangaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { db, user, refresh } = useApp();
  const online = useOnline();
  const campo = db.campos.find((c) => c.id === id)!;
  const miembro = campo.miembros.find((m) => m.userId === user!.id);
  const rol = rolEnCampo(user!.id, id);
  const habilitado = puede(rol, "capturar", permisosDe(miembro));

  const animales = useMemo(() => db.animales.filter((a) => a.campoId === id), [db.animales, id]);
  const pendientes = contarPendientes(db.eventos.filter((e) => e.campoId === id));

  const [cii, setCii] = useState("");
  const [leido, setLeido] = useState<string | null>(null);
  const [sesion, setSesion] = useState<BluetoothSesion | null>(null);
  const [estadoLector, setEstadoLector] = useState<"idle" | "conectando" | "esperando" | "error">("idle");
  const [errorBt, setErrorBt] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const animal = leido ? animales.find((a) => a.caravana === leido && esActivo(a)) : undefined;
  const formato = leido ? validarFormatoCII(leido) : null;

  if (!habilitado) {
    return (
      <div className="card p-10 text-center text-ink-muted">
        Tu rol no tiene permiso para capturar en manga.
      </div>
    );
  }

  function procesarCII(valor: string) {
    const v = valor.trim();
    if (!v) return;
    setLeido(v);
    setOkMsg(null);
    // Registra la lectura en el origen: queda disponible para asociar a un evento.
    registrarLectura(id, v, user!.id, sesion ? "bluetooth" : "manual", sesion?.deviceName);
    refresh();
  }

  async function conectar() {
    setErrorBt(null);
    if (!bluetoothDisponible()) {
      setErrorBt("Web Bluetooth no disponible en este navegador. Usá carga manual o importá CSV/TXT.");
      return;
    }
    setEstadoLector("conectando");
    try {
      const s = await conectarLectorRFID((chunk) => {
        const linea = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop();
        if (linea) procesarCII(linea);
      });
      setSesion(s);
      setEstadoLector("esperando");
    } catch (e: any) {
      setEstadoLector("error");
      setErrorBt(e?.message ?? "No se pudo conectar al lector.");
    }
  }

  function irA(destino: "sanidad" | "pesajes" | "movimientos") {
    if (!animal) return;
    router.push(`/campos/${id}/${destino}?animal=${animal.id}`);
  }

  function siguiente() {
    setLeido(null);
    setCii("");
    setOkMsg("Listo. Pasá el siguiente animal por la manga.");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Indicador de modo, lo más importante de la pantalla */}
      <div
        className={`rounded-2xl border p-4 flex items-center justify-between ${
          online
            ? "border-success/30 bg-success/5"
            : "border-error/40 bg-error/10"
        }`}
      >
        <div className="flex items-center gap-3">
          {online ? (
            <Wifi className="text-success" />
          ) : (
            <WifiOff className="text-error" />
          )}
          <div>
            <div className={`font-display text-lg ${online ? "text-success" : "text-error"}`}>
              {online ? "CON CONEXIÓN" : "SIN CONEXIÓN"}
            </div>
            <div className="text-xs text-ink-muted">
              {online ? "Se sincroniza al cerrar." : "Trabajás offline. Nada se pierde."}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl text-warning leading-none">{pendientes}</div>
          <div className="text-xs text-ink-muted">en cola</div>
        </div>
      </div>

      {/* Captura */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine size={18} className="text-accent" />
            <h3 className="font-display text-xl text-ink">Captura en manga</h3>
          </div>
          <button
            type="button"
            onClick={conectar}
            disabled={estadoLector === "conectando"}
            className="btn-ghost text-sm"
          >
            <Bluetooth size={14} />
            {estadoLector === "esperando"
              ? sesion?.deviceName ?? "Lector conectado"
              : estadoLector === "conectando"
              ? "Conectando…"
              : "Conectar lector"}
          </button>
        </div>

        {estadoLector === "esperando" && !leido && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-6 text-center text-accent text-sm animate-pulse">
            Esperando lectura del bastón… pasá el animal por la manga.
          </div>
        )}
        {errorBt && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            {errorBt}
          </div>
        )}

        {/* Carga manual (fallback) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            procesarCII(cii);
          }}
          className="flex gap-2"
        >
          <input
            className="input font-mono text-lg tracking-widest"
            value={cii}
            onChange={(e) => setCii(e.target.value)}
            placeholder="0123456789"
            inputMode="numeric"
          />
          <button className="btn-primary text-sm whitespace-nowrap">
            <ScanLine size={14} /> Leer
          </button>
        </form>

        {okMsg && (
          <div className="text-sm text-success flex items-center gap-2">
            <CheckCircle2 size={15} /> {okMsg}
          </div>
        )}
      </div>

      {/* Resultado de la lectura */}
      {leido && (
        <div className="card p-5 space-y-4">
          <div className="text-center">
            <div className="label mb-1">CII leído</div>
            <div className="font-mono text-4xl tracking-wider text-accent">{leido}</div>
            {formato && !formato.ok && (
              <div className="text-error text-sm mt-2 flex items-center justify-center gap-1">
                <AlertTriangle size={14} /> {formato.error}
              </div>
            )}
          </div>

          {animal ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <MiniDato label="Categoría" valor={animal.categoria || "—"} />
                <MiniDato label="Color" valor={animal.colorCaravana || "—"} />
                <MiniDato label="Estado" valor={estado(animal)} />
                <MiniDato label="Último peso" valor={animal.peso ? `${animal.peso} kg` : "—"} />
              </div>
              <Semaforo animal={animal} />
              <div className="grid grid-cols-3 gap-3">
                <BotonAccion icon={Syringe} label="Sanidad" onClick={() => irA("sanidad")} disabled={!puede(rol, "sanidad", permisosDe(miembro))} />
                <BotonAccion icon={Scale} label="Pesaje" onClick={() => irA("pesajes")} disabled={!puede(rol, "pesaje", permisosDe(miembro))} />
                <BotonAccion icon={ArrowRightLeft} label="Mover" onClick={() => irA("movimientos")} disabled={!puede(rol, "movimiento", permisosDe(miembro))} />
              </div>
              <button onClick={siguiente} className="btn-ghost w-full text-sm">
                Guardar y siguiente →
              </button>
              <p className="text-center text-xs text-ink-dim">
                Guardado local… nada se pierde.
              </p>
            </>
          ) : formato?.ok ? (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-center text-sm text-warning">
              <div className="mb-3">No existe un animal activo con este CII.</div>
              <button
                onClick={() => router.push(`/campos/${id}/animales`)}
                className="btn-primary text-sm"
              >
                <Plus size={14} /> Dar de alta
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Semaforo({ animal }: { animal: Animal }) {
  const apt = aptitud(animal);
  const cls =
    apt.color === "verde"
      ? "border-success/30 bg-success/5 text-success"
      : apt.color === "amber"
      ? "border-warning/30 bg-warning/5 text-warning"
      : "border-error/30 bg-error/5 text-error";
  return (
    <div className={`rounded-xl border px-3 py-2 text-sm text-center ${cls}`}>{apt.texto}</div>
  );
}

function MiniDato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft/40 py-2">
      <div className="label">{label}</div>
      <div className="text-ink text-sm capitalize">{valor}</div>
    </div>
  );
}

function BotonAccion({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: any;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-bg-soft/40 py-5 text-ink hover:border-accent/40 hover:bg-accent/5 transition disabled:opacity-30 disabled:cursor-not-allowed"
    >
      <Icon size={26} className="text-accent" />
      <span className="text-sm">{label}</span>
    </button>
  );
}
