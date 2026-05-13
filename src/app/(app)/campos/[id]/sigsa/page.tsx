"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Layers,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import {
  deshacerDeclaracion,
  exportarPendientesCSV,
  exportarPendientesXLSX,
  marcarComoDeclarados,
  resumenPorLote,
  totalPendientes,
  type ResumenLoteSigsa,
} from "@/lib/sigsa";

const SIGSA_URL = "https://www.argentina.gob.ar/senasa";

export default function SigsaBotPage() {
  const { id } = useParams<{ id: string }>();
  const { db, user, refresh } = useApp();
  const rol = rolEnCampo(user!.id, id);
  const puedeDeclarar = rol === "admin" || rol === "usuario";

  const lotes = useMemo(() => db.lotes.filter((l) => l.campoId === id), [db.lotes, id]);
  const animalesCampo = useMemo(
    () => db.animales.filter((a) => a.campoId === id),
    [db.animales, id]
  );
  const resumen = useMemo(() => resumenPorLote(lotes, animalesCampo), [lotes, animalesCampo]);
  const totalPend = totalPendientes(animalesCampo);

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
              Generá automáticamente el archivo de carga masiva con las{" "}
              <strong className="text-ink">caravanas que todavía no fueron declaradas</strong>{" "}
              en SIGSA. Elegí un lote, descargá el archivo, subilo a SIGSA en una sola
              carga y volvé acá a confirmar.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="chip">
                <Sparkles size={12} className="text-accent" />
                {totalPend} caravana{totalPend === 1 ? "" : "s"} pendiente
                {totalPend === 1 ? "" : "s"} en este campo
              </span>
              <a
                href={SIGSA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                Abrir SIGSA <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </div>
      </div>

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
              onChange={refresh}
              indice={idx}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SnapshotPendiente {
  ids: string[];
  fecha: number;
}

function LoteSigsaCard({
  resumen,
  userId,
  onChange,
  indice,
}: {
  resumen: ResumenLoteSigsa;
  userId: string;
  onChange: () => void;
  indice: number;
}) {
  const { lote, pendientes, declarados, total } = resumen;
  const [abierto, setAbierto] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotPendiente | null>(null);
  const [marcado, setMarcado] = useState<{
    ids: string[];
    yaDeclarados: number;
  } | null>(null);

  const sinPendientes = pendientes.length === 0;
  const pct = total === 0 ? 0 : Math.round((declarados / total) * 100);

  function descargarCSV() {
    if (pendientes.length === 0) return;
    exportarPendientesCSV(pendientes, lote.nombre);
    setSnapshot({ ids: pendientes.map((a) => a.id), fecha: Date.now() });
    setMarcado(null);
  }

  function descargarXLSX() {
    if (pendientes.length === 0) return;
    exportarPendientesXLSX(pendientes, lote.nombre);
    setSnapshot({ ids: pendientes.map((a) => a.id), fecha: Date.now() });
    setMarcado(null);
  }

  function confirmar() {
    if (!snapshot) return;
    const r = marcarComoDeclarados(snapshot.ids, userId);
    setMarcado({ ids: snapshot.ids, yaDeclarados: r.yaDeclarados });
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
    onChange();
    alert(`Se devolvieron ${n} caravana(s) a pendientes.`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: indice * 0.03 }}
      className={`card p-5 transition ${
        sinPendientes ? "opacity-70" : "hover:border-accent/30"
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
          {sinPendientes ? (
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
                titulo="Generar archivo SIGSA"
                descripcion={
                  marcado
                    ? "Archivo descargado y declaración confirmada."
                    : `Descargá el archivo con las ${pendientes.length} caravana(s) pendientes en formato CSV o XLSX.`
                }
                done={!!snapshot || !!marcado}
              >
                {!marcado && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={descargarCSV} className="btn-primary text-sm">
                        <FileText size={14} /> Descargar CSV
                      </button>
                      <button onClick={descargarXLSX} className="btn-ghost text-sm">
                        <FileSpreadsheet size={14} /> Descargar XLSX
                      </button>
                    </div>
                    <PreviewCaravanas pendientes={pendientes} />
                  </>
                )}
              </PasoFlujo>

              <PasoFlujo
                n={2}
                titulo="Subir a SIGSA"
                descripcion="Abrí SIGSA, ingresá con tu CUIT/clave y subí el archivo recién descargado."
                done={!!marcado}
                disabled={!snapshot && !marcado}
              >
                {!marcado && (
                  <a
                    href={SIGSA_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-sm"
                  >
                    <ExternalLink size={14} /> Abrir SIGSA
                  </a>
                )}
              </PasoFlujo>

              <PasoFlujo
                n={3}
                titulo="Confirmar declaración"
                descripcion={
                  marcado
                    ? "Hecho — las caravanas figuran como declaradas."
                    : snapshot
                    ? `Una vez subido en SIGSA, marcá las ${snapshot.ids.length} caravana(s) como declaradas.`
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
                    {marcado.ids.length - marcado.yaDeclarados === 1 ? "" : "s"}.{" "}
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
