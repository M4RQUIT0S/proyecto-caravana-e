"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Layers,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { Modal } from "@/components/Modal";
import {
  borrarCredencialesAfip,
  deshacerDeclaracion,
  exportarPendientesCSV,
  exportarPendientesXLSX,
  formatCuit,
  guardarCredencialesAfip,
  marcarComoDeclarados,
  resumenPorLote,
  totalPendientes,
  type ResumenLoteSigsa,
} from "@/lib/sigsa";
import type { AfipCredenciales } from "@/lib/types";

const SIGSA_URL = "https://www.argentina.gob.ar/senasa";

export default function SigsaBotPage() {
  const { id } = useParams<{ id: string }>();
  const { db, user, refresh } = useApp();
  const rol = rolEnCampo(user!.id, id);
  const puedeDeclarar = rol === "admin" || rol === "usuario";
  const campo = db.campos.find((c) => c.id === id);
  const afip = campo?.afip;

  const lotes = useMemo(() => db.lotes.filter((l) => l.campoId === id), [db.lotes, id]);
  const animalesCampo = useMemo(
    () => db.animales.filter((a) => a.campoId === id),
    [db.animales, id]
  );
  const resumen = useMemo(() => resumenPorLote(lotes, animalesCampo), [lotes, animalesCampo]);
  const totalPend = totalPendientes(animalesCampo);

  const [credsOpen, setCredsOpen] = useState(false);

  if (!puedeDeclarar) {
    return (
      <div className="card p-8 text-ink-muted">
        Tu rol es <strong className="text-ink">sólo vista</strong>: no podés operar el
        bot de SIGSA. Pedile a un admin que cambie tu rol.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 border-accent/40 bg-accent/5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-accent/15 p-2.5 text-accent">
            <Bot size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-xl text-ink">Bot SIGSA — ARCA</h3>
            <p className="text-sm text-ink-muted mt-1">
              Genera el archivo de carga, te abre SIGSA con tus credenciales en el
              portapapeles para que ingreses en 1 segundo, y guarda el número de acta
              de vacunación junto con la declaración.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="chip">
                <Sparkles size={12} className="text-accent" />
                {totalPend} pendiente{totalPend === 1 ? "" : "s"} en este campo
              </span>
            </div>
          </div>
        </div>
      </div>

      <CredencialesAfipCard
        afip={afip}
        onAbrir={() => setCredsOpen(true)}
        onBorrar={() => {
          if (
            confirm(
              "¿Borrar las credenciales AFIP guardadas en este dispositivo? El bot te las volverá a pedir la próxima vez."
            )
          ) {
            borrarCredencialesAfip(id);
            refresh();
          }
        }}
      />

      {lotes.length === 0 ? (
        <div className="card p-10 text-center text-ink-muted">
          <Layers className="mx-auto mb-3 text-ink-dim" />
          Todavía no hay lotes en este campo.{" "}
          <Link href={`/campos/${id}/lotes`} className="text-accent hover:underline">
            Crear el primer lote
          </Link>
          .
        </div>
      ) : (
        <div className="grid gap-4">
          {resumen.map((r, idx) => (
            <LoteSigsaCard
              key={r.lote.id}
              resumen={r}
              userId={user!.id}
              afip={afip}
              onChange={refresh}
              onPedirCredenciales={() => setCredsOpen(true)}
              indice={idx}
            />
          ))}
        </div>
      )}

      <AfipModal
        open={credsOpen}
        onClose={() => setCredsOpen(false)}
        campoId={id}
        actual={afip}
        onSaved={() => {
          setCredsOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

function CredencialesAfipCard({
  afip,
  onAbrir,
  onBorrar,
}: {
  afip?: AfipCredenciales;
  onAbrir: () => void;
  onBorrar: () => void;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-xl p-2.5 ${
              afip ? "bg-accent/15 text-accent" : "bg-bg-soft text-ink-dim"
            }`}
          >
            <KeyRound size={18} />
          </div>
          <div>
            <div className="font-display text-base text-ink flex items-center gap-2">
              Credenciales AFIP
              {afip && (
                <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                  <ShieldCheck size={11} /> Guardadas
                </span>
              )}
            </div>
            {afip ? (
              <div className="text-sm text-ink-muted">
                CUIT <span className="font-mono text-ink">{formatCuit(afip.cuit)}</span>{" "}
                · clave guardada (••••••)
              </div>
            ) : (
              <div className="text-sm text-ink-muted">
                Configurá CUIT y Clave Fiscal una sola vez. El bot las usa para llenar
                el login de SIGSA cuando dispares la solicitud.
              </div>
            )}
            <div className="text-[11px] text-ink-dim mt-1.5">
              ⚠ Se guardan en este dispositivo (localStorage). Esta app no las envía a
              ningún servidor.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {afip && (
            <button onClick={onBorrar} className="btn-ghost text-sm" title="Borrar credenciales">
              <Trash2 size={14} /> Borrar
            </button>
          )}
          <button onClick={onAbrir} className="btn-primary text-sm">
            <KeyRound size={14} />
            {afip ? "Actualizar" : "Configurar AFIP"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AfipModal({
  open,
  onClose,
  campoId,
  actual,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  campoId: string;
  actual?: AfipCredenciales;
  onSaved: () => void;
}) {
  const [cuit, setCuit] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCuit(actual ? formatCuit(actual.cuit) : "");
      setClave(actual?.clave ?? "");
      setVerClave(false);
      setErr(null);
    }
  }, [open, actual]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const soloDigitos = cuit.replace(/\D/g, "");
    if (soloDigitos.length !== 11) {
      setErr("El CUIT debe tener 11 dígitos.");
      return;
    }
    if (!clave) {
      setErr("Ingresá tu Clave Fiscal.");
      return;
    }
    guardarCredencialesAfip(campoId, soloDigitos, clave);
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Credenciales AFIP">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-amber-300/30 bg-amber-300/5 p-3 text-xs text-ink-muted">
          ⚠ Estas credenciales se guardan <strong className="text-ink">solo en este
          dispositivo</strong> (localStorage del navegador). Esta app no tiene servidor
          y no las envía a ningún lado. Si compartís este dispositivo, mejor borrarlas
          al terminar.
        </div>
        <div>
          <label className="label block mb-1.5">CUIT</label>
          <input
            autoFocus
            className="input font-mono"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="20-12345678-3"
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="label block mb-1.5">Clave Fiscal</label>
          <div className="relative">
            <input
              type={verClave ? "text" : "password"}
              className="input pr-10"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Clave Fiscal de AFIP"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setVerClave((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-dim hover:text-ink"
              tabIndex={-1}
            >
              {verClave ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        {err && <div className="text-sm text-red-300">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancelar
          </button>
          <button className="btn-primary text-sm">
            <ShieldCheck size={14} /> Guardar credenciales
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface SnapshotPendiente {
  ids: string[];
  fecha: number;
  acta: string;
}

function LoteSigsaCard({
  resumen,
  userId,
  afip,
  onChange,
  onPedirCredenciales,
  indice,
}: {
  resumen: ResumenLoteSigsa;
  userId: string;
  afip?: AfipCredenciales;
  onChange: () => void;
  onPedirCredenciales: () => void;
  indice: number;
}) {
  const { lote, pendientes, declarados, total } = resumen;
  const [abierto, setAbierto] = useState(false);
  const [acta, setActa] = useState("");
  const [snapshot, setSnapshot] = useState<SnapshotPendiente | null>(null);
  const [marcado, setMarcado] = useState<{
    ids: string[];
    yaDeclarados: number;
    acta: string;
  } | null>(null);
  const [credsCopiadas, setCredsCopiadas] = useState<"cuit" | "clave" | null>(null);

  const sinPendientes = pendientes.length === 0;
  const pct = total === 0 ? 0 : Math.round((declarados / total) * 100);
  const actaValida = acta.trim().length > 0;

  function descargarCSV() {
    if (pendientes.length === 0 || !actaValida) return;
    exportarPendientesCSV(pendientes, lote.nombre, acta.trim());
    setSnapshot({
      ids: pendientes.map((a) => a.id),
      fecha: Date.now(),
      acta: acta.trim(),
    });
    setMarcado(null);
  }

  function descargarXLSX() {
    if (pendientes.length === 0 || !actaValida) return;
    exportarPendientesXLSX(pendientes, lote.nombre, acta.trim());
    setSnapshot({
      ids: pendientes.map((a) => a.id),
      fecha: Date.now(),
      acta: acta.trim(),
    });
    setMarcado(null);
  }

  async function iniciarSesion() {
    if (!afip) {
      onPedirCredenciales();
      return;
    }
    try {
      await navigator.clipboard.writeText(afip.cuit);
      setCredsCopiadas("cuit");
      window.open(SIGSA_URL, "_blank", "noopener,noreferrer");
      setTimeout(async () => {
        try {
          await navigator.clipboard.writeText(afip.clave);
          setCredsCopiadas("clave");
        } catch {
          // ignore — el usuario ya tiene CUIT en el portapapeles
        }
      }, 4000);
    } catch {
      window.open(SIGSA_URL, "_blank", "noopener,noreferrer");
      alert(
        "No pude copiar al portapapeles automáticamente — copiá CUIT y Clave manualmente desde la sección 'Credenciales AFIP'."
      );
    }
  }

  function copiarClave() {
    if (!afip) return;
    navigator.clipboard.writeText(afip.clave).then(
      () => setCredsCopiadas("clave"),
      () => alert("No se pudo copiar la clave.")
    );
  }

  function confirmar() {
    if (!snapshot) return;
    const r = marcarComoDeclarados(snapshot.ids, userId, snapshot.acta);
    setMarcado({
      ids: snapshot.ids,
      yaDeclarados: r.yaDeclarados,
      acta: snapshot.acta,
    });
    setSnapshot(null);
    onChange();
  }

  function deshacer() {
    if (!marcado) return;
    if (
      !confirm(
        `¿Deshacer la declaración del lote "${lote.nombre}"? Las caravanas volverán a quedar pendientes.`
      )
    )
      return;
    const n = deshacerDeclaracion(marcado.ids);
    setMarcado(null);
    setActa("");
    onChange();
    alert(`Se devolvieron ${n} caravana(s) a pendientes.`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: indice * 0.03 }}
      className={`card p-5 transition ${
        sinPendientes && !marcado ? "opacity-70" : "hover:border-accent/30"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-display text-lg text-ink truncate">{lote.nombre}</div>
            <span className="chip text-[11px]">
              {lote.categoria || "—"} · {lote.raza || "—"}
            </span>
          </div>
          <div className="mt-2 text-sm text-ink-muted">
            <strong className={pendientes.length > 0 ? "text-accent" : "text-ink"}>
              {pendientes.length}
            </strong>{" "}
            pendiente{pendientes.length === 1 ? "" : "s"} ·{" "}
            <span className="text-ink-dim">
              {declarados}/{total} ya declaradas
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-bg-soft overflow-hidden max-w-md">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sinPendientes && !marcado ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-accent">
              <CheckCircle2 size={14} /> Todas declaradas
            </span>
          ) : (
            <button
              onClick={() => setAbierto((v) => !v)}
              className="btn-primary text-sm"
            >
              <Bot size={14} />
              {abierto ? "Cerrar" : `Cargar ${pendientes.length} a SIGSA`}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {abierto && (!sinPendientes || marcado) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-5 rounded-xl border border-line bg-bg-soft/40 p-4 space-y-4">
              <PasoFlujo
                n={1}
                titulo="Número de acta de vacunación"
                descripcion="Es el acta donde figuran estas caravanas. Se incluye en el archivo SIGSA y queda guardada en cada animal."
                done={!!snapshot || !!marcado}
              >
                {marcado ? (
                  <div className="text-sm text-ink">
                    Acta:{" "}
                    <code className="font-mono text-accent bg-bg-soft px-2 py-0.5 rounded border border-line">
                      {marcado.acta}
                    </code>
                  </div>
                ) : (
                  <input
                    className="input max-w-xs font-mono"
                    placeholder="Ej: 12345-6789"
                    value={acta}
                    onChange={(e) => setActa(e.target.value)}
                  />
                )}
              </PasoFlujo>

              <PasoFlujo
                n={2}
                titulo="Generar archivo SIGSA"
                descripcion={
                  marcado
                    ? "Archivo descargado y declaración confirmada."
                    : actaValida
                    ? `Descargá el archivo con las ${pendientes.length} caravana(s) pendientes.`
                    : "Cargá primero el número de acta de vacunación."
                }
                done={!!snapshot || !!marcado}
                disabled={!actaValida && !marcado}
              >
                {!marcado && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={descargarCSV}
                        disabled={!actaValida}
                        className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FileText size={14} /> Descargar CSV
                      </button>
                      <button
                        onClick={descargarXLSX}
                        disabled={!actaValida}
                        className="btn-ghost text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FileSpreadsheet size={14} /> Descargar XLSX
                      </button>
                    </div>
                    <PreviewCaravanas pendientes={pendientes} />
                  </>
                )}
              </PasoFlujo>

              <PasoFlujo
                n={3}
                titulo="Iniciar sesión en SIGSA"
                descripcion={
                  afip
                    ? "El bot copia tu CUIT al portapapeles y abre SIGSA. Pegalo en el campo CUIT y, a los segundos, copio la clave. Pegala y entrá."
                    : "Necesitás configurar tus credenciales AFIP (botón arriba) para que el bot pueda completar el login."
                }
                done={!!marcado}
                disabled={(!snapshot && !marcado) || !afip}
              >
                {!marcado && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={iniciarSesion}
                      disabled={!snapshot}
                      className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ExternalLink size={14} />
                      {afip ? "Abrir SIGSA con mi CUIT copiado" : "Configurar AFIP"}
                    </button>
                    {afip && credsCopiadas === "cuit" && (
                      <button onClick={copiarClave} className="btn-ghost text-sm">
                        <ClipboardCheck size={14} /> Copiar clave ahora
                      </button>
                    )}
                    {credsCopiadas && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-accent">
                        <ClipboardCheck size={12} />
                        {credsCopiadas === "cuit"
                          ? "CUIT copiado — pegá en SIGSA"
                          : "Clave copiada — pegá en SIGSA"}
                      </span>
                    )}
                  </div>
                )}
              </PasoFlujo>

              <PasoFlujo
                n={4}
                titulo="Confirmar declaración"
                descripcion={
                  marcado
                    ? "Hecho — las caravanas figuran como declaradas con el acta guardada."
                    : snapshot
                    ? `Una vez subido el archivo en SIGSA, marcá las ${snapshot.ids.length} caravana(s) como declaradas con acta ${snapshot.acta}.`
                    : "Marcá las caravanas como declaradas cuando termines la carga en SIGSA."
                }
                done={!!marcado}
                disabled={!snapshot && !marcado}
              >
                {!marcado && (
                  <button
                    onClick={confirmar}
                    disabled={!snapshot}
                    className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 size={14} />
                    {snapshot
                      ? `Marcar ${snapshot.ids.length} como declaradas`
                      : "Marcar como declaradas"}
                  </button>
                )}
              </PasoFlujo>

              {marcado && (
                <div className="flex items-start gap-3 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2.5">
                  <CheckCircle2 size={16} className="text-accent mt-0.5 shrink-0" />
                  <div className="text-sm text-ink flex-1">
                    Listo — {marcado.ids.length - marcado.yaDeclarados} caravana
                    {marcado.ids.length - marcado.yaDeclarados === 1 ? "" : "s"} marcada
                    {marcado.ids.length - marcado.yaDeclarados === 1 ? "" : "s"} como
                    declarada
                    {marcado.ids.length - marcado.yaDeclarados === 1 ? "" : "s"} con
                    acta{" "}
                    <code className="font-mono text-accent">{marcado.acta}</code>.{" "}
                    {marcado.yaDeclarados > 0 && (
                      <span className="text-ink-muted">
                        ({marcado.yaDeclarados} ya estaban declaradas y se omitieron.)
                      </span>
                    )}
                  </div>
                  <button onClick={deshacer} className="btn-ghost text-xs shrink-0">
                    <Undo2 size={12} /> Deshacer
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function PasoFlujo({
  n,
  titulo,
  descripcion,
  done,
  disabled,
  children,
}: {
  n: number;
  titulo: string;
  descripcion: string;
  done?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex gap-3 ${disabled ? "opacity-50" : ""} ${
        done ? "text-ink" : ""
      }`}
    >
      <div
        className={`shrink-0 h-7 w-7 rounded-full border flex items-center justify-center text-xs font-medium ${
          done
            ? "bg-accent/20 border-accent/50 text-accent"
            : "border-line text-ink-muted"
        }`}
      >
        {done ? <CheckCircle2 size={14} /> : n}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <div className="font-display text-sm text-ink">{titulo}</div>
          <div className="text-xs text-ink-muted">{descripcion}</div>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function PreviewCaravanas({ pendientes }: { pendientes: { id: string; caravana: string }[] }) {
  const [verTodo, setVerTodo] = useState(false);
  const muestra = verTodo ? pendientes : pendientes.slice(0, 12);
  if (pendientes.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="label">Caravanas en el archivo</div>
        {pendientes.length > 12 && (
          <button
            onClick={() => setVerTodo((v) => !v)}
            className="text-xs text-accent hover:underline"
          >
            {verTodo ? "Ver menos" : `Ver las ${pendientes.length}`}
          </button>
        )}
      </div>
      <div className="rounded-lg border border-line bg-bg/60 p-2 max-h-44 overflow-auto">
        <div className="flex flex-wrap gap-1.5">
          {muestra.map((a) => (
            <code
              key={a.id}
              className="font-mono text-[11px] text-accent bg-bg-soft px-2 py-0.5 rounded border border-line"
            >
              {a.caravana}
            </code>
          ))}
          {!verTodo && pendientes.length > 12 && (
            <span className="text-[11px] text-ink-dim self-center px-1">
              + {pendientes.length - 12} más
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
