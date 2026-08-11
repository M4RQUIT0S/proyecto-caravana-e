"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  Tags,
  BellRing,
  X,
  Check,
  Pencil,
  Download,
  FileSpreadsheet,
  FileText,
  ArrowRightLeft,
  Syringe,
  Scale,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { uid, update } from "@/lib/storage";
import { Modal } from "@/components/Modal";
import { TonoBadge, type Tono } from "@/components/Tono";
import { descargarCSV, exportarAnimalesCSV, exportarAnimalesXLSX } from "@/lib/export";
import {
  caravanaUnicaActiva,
  colorCaravana,
  esActivo,
  identificacionTemprana,
  validarFormatoCII,
} from "@/lib/reglas";
import { validarAltaCoherencia, historialDeAnimal, aptitud } from "@/lib/eventos";
import { estado as estadoAnimal, fechaISO } from "@/lib/reglas";
import { puede, permisosDe } from "@/lib/permisos";
import { RAZAS, CATEGORIAS } from "@/lib/clasificacion";
import type { Animal, Alerta } from "@/lib/types";

export default function AnimalesPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { db, user, refresh } = useApp();
  const rol = rolEnCampo(user!.id, id);
  // Espejo de permisos.ts (y de member_permite en la RLS): el alta la habilita `puede()`,
  // no una lista de roles a mano — así el Operador delegado con captura habilitada puede
  // dar de alta, igual que se lo permite Postgres.
  const miembro = db.campos.find((c) => c.id === id)?.miembros.find((m) => m.userId === user!.id);
  const puedeCrear = puede(rol, "alta", permisosDe(miembro));
  const esAdmin = rol === "admin";

  const [filtro, setFiltro] = useState("");
  const [loteSel, setLoteSel] = useState(sp.get("lote") ?? "");
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Animal | null>(null);
  const [detalle, setDetalle] = useState<Animal | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [destinoLote, setDestinoLote] = useState<string>("");

  const lotes = db.lotes.filter((l) => l.campoId === id);
  const animales = useMemo(() => {
    let list = db.animales.filter((a) => a.campoId === id && esActivo(a));
    if (loteSel === "_sin") list = list.filter((a) => !a.loteId);
    else if (loteSel) list = list.filter((a) => a.loteId === loteSel);
    if (filtro.trim()) {
      const q = filtro.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.caravana.toLowerCase().includes(q) ||
          a.nombre?.toLowerCase().includes(q) ||
          a.raza?.toLowerCase().includes(q) ||
          a.categoria?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [db.animales, id, loteSel, filtro]);

  function eliminar(animalId: string) {
    if (!confirm("¿Dar de baja este animal? Queda inactivo pero conserva su historial.")) return;
    update((db) => {
      const a = db.animales.find((x) => x.id === animalId);
      if (a) {
        a.activo = false;
        a.updatedAt = Date.now();
      }
    });
    refresh();
  }

  function toggleSeleccion(animalId: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(animalId)) next.delete(animalId);
      else next.add(animalId);
      return next;
    });
  }

  function seleccionarTodosVisibles() {
    const idsVisibles = animales.map((a) => a.id);
    const todosSelec = idsVisibles.every((aid) => seleccion.has(aid));
    setSeleccion(todosSelec ? new Set() : new Set(idsVisibles));
  }

  function moverSeleccionados() {
    if (seleccion.size === 0) return;
    const ids = Array.from(seleccion);
    const nombreDestino =
      destinoLote === "" ? "sin lote" : lotes.find((l) => l.id === destinoLote)?.nombre ?? "lote";
    if (!confirm(`Mover ${ids.length} animal(es) a ${nombreDestino}?`)) return;
    update((db) => {
      const now = Date.now();
      for (const aid of ids) {
        const a = db.animales.find((x) => x.id === aid);
        if (a && a.campoId === id) {
          a.loteId = destinoLote || undefined;
          a.updatedAt = now;
        }
      }
    });
    setSeleccion(new Set());
    setDestinoLote("");
    refresh();
  }

  function limpiarSeleccion() {
    setSeleccion(new Set());
    setDestinoLote("");
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-line bg-bg-soft px-3 py-2">
          <Search size={15} className="text-ink-dim" />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por caravana, nombre, raza…"
            className="w-full bg-transparent outline-none text-sm placeholder:text-ink-dim"
          />
        </div>
        <select
          className="input sm:max-w-[200px]"
          value={loteSel}
          onChange={(e) => setLoteSel(e.target.value)}
        >
          <option value="">Todos los lotes</option>
          <option value="_sin">Sin lote</option>
          {lotes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
        {animales.length > 0 && (
          <ExportarMenu
            onCSV={() => exportarAnimalesCSV(animales, lotes)}
            onXLSX={() => exportarAnimalesXLSX(animales, lotes)}
          />
        )}
        {puedeCrear && (
          <button onClick={() => setOpen(true)} className="btn-primary text-sm">
            <Plus size={14} /> Nuevo animal
          </button>
        )}
      </div>

      <AnimatePresence>
        {esAdmin && seleccion.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="card p-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-3 border-accent/40"
          >
            <div className="text-sm text-ink">
              <strong className="text-accent">{seleccion.size}</strong>{" "}
              animal{seleccion.size === 1 ? "" : "es"} seleccionado
              {seleccion.size === 1 ? "" : "s"}
            </div>
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="label text-xs sm:mr-1">Mover a lote:</label>
              <select
                className="input sm:max-w-[220px]"
                value={destinoLote}
                onChange={(e) => setDestinoLote(e.target.value)}
              >
                <option value="">Sin lote</option>
                {lotes.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.nombre}
                  </option>
                ))}
              </select>
              <button onClick={moverSeleccionados} className="btn-primary text-sm">
                <ArrowRightLeft size={14} /> Mover
              </button>
              <button onClick={limpiarSeleccion} className="btn-ghost text-sm">
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {animales.length === 0 ? (
        <div className="card p-10 text-center text-ink-muted">
          <Tags className="mx-auto mb-3 text-ink-dim" />
          No hay animales que coincidan.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div
            className={`hidden md:grid ${
              esAdmin
                ? "grid-cols-[36px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.5fr)_auto]"
                : "grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.5fr)_auto]"
            } gap-3 px-4 py-2 border-b border-line text-xs uppercase tracking-[0.06em] text-ink-muted`}
          >
            {esAdmin && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={
                    animales.length > 0 &&
                    animales.every((a) => seleccion.has(a.id))
                  }
                  onChange={seleccionarTodosVisibles}
                  className="accent-accent cursor-pointer"
                  title="Seleccionar todos los visibles"
                />
              </div>
            )}
            <div>Caravana</div>
            <div>Nombre</div>
            <div>Categoría</div>
            <div>Raza</div>
            <div>Lote</div>
            <div>Alertas</div>
            <div></div>
          </div>
          <ul>
            {animales.map((a, idx) => {
              const lote = db.lotes.find((l) => l.id === a.loteId);
              const activas = a.alertas.filter((x) => !x.resuelta).length;
              const seleccionado = seleccion.has(a.id);
              return (
                <li
                  key={a.id}
                  className={`grid grid-cols-2 ${
                    esAdmin
                      ? "md:grid-cols-[36px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.5fr)_auto]"
                      : "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.5fr)_auto]"
                  } gap-3 px-4 py-2 text-sm border-b border-line last:border-0 hover:bg-bg-soft transition cursor-pointer ${
                    seleccionado ? "bg-accent/5" : ""
                  }`}
                  onClick={() => setDetalle(a)}
                >
                  {esAdmin && (
                    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={seleccionado}
                        onChange={() => toggleSeleccion(a.id)}
                        className="accent-accent cursor-pointer"
                      />
                    </div>
                  )}
                  <div className="tnum font-mono text-ink flex min-w-0 items-center gap-2">
                    {a.caravana}
                    {(() => {
                      const est = estadoAnimal(a);
                      if (est === "activo") return null;
                      const tono: Tono =
                        est === "muerto" ? "error" : est === "egresado" ? "neutral" : "warning";
                      const txt = est === "en_carencia" ? "carencia" : est;
                      return <TonoBadge tono={tono} className="capitalize">{txt}</TonoBadge>;
                    })()}
                  </div>
                  <div className="text-ink">{a.nombre || "—"}</div>
                  <div className="text-ink-muted">{a.categoria || "—"}</div>
                  <div className="text-ink-muted">{a.raza || "—"}</div>
                  <div className="text-ink-muted">{lote?.nombre || "—"}</div>
                  <div>
                    {activas > 0 ? (
                      <span className="inline-flex items-center gap-1 text-warning text-xs">
                        <BellRing size={12} />
                        {activas}
                      </span>
                    ) : (
                      <span className="text-ink-dim text-xs">—</span>
                    )}
                  </div>
                  {esAdmin ? (
                    <div className="flex items-center gap-2 justify-self-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditando(a);
                        }}
                        className="text-ink-dim hover:text-accent"
                        title="Editar animal"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          eliminar(a.id);
                        }}
                        className="text-ink-dim hover:text-error"
                        title="Eliminar animal"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : (
                    <span />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <AnimalFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          refresh();
        }}
        campoId={id}
        loteSel={loteSel && loteSel !== "_sin" ? loteSel : undefined}
      />

      <AnimalFormModal
        open={!!editando}
        onClose={() => setEditando(null)}
        onSaved={() => {
          setEditando(null);
          refresh();
        }}
        campoId={id}
        animal={editando ?? undefined}
      />

      <AnimalDetalle
        animal={detalle}
        onClose={() => setDetalle(null)}
        puedeEditar={!!puedeCrear}
        onChange={refresh}
      />
    </div>
  );
}

function AnimalFormModal({
  open,
  onClose,
  onSaved,
  campoId,
  loteSel,
  animal,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  campoId: string;
  loteSel?: string;
  animal?: Animal;
}) {
  const { db } = useApp();
  const campo = db.campos.find((c) => c.id === campoId);
  const lotes = db.lotes.filter((l) => l.campoId === campoId);
  const editMode = !!animal;
  const formInicial = () => ({
    caravana: animal?.caravana ?? "",
    nombre: animal?.nombre ?? "",
    sexo: animal?.sexo ?? "",
    raza: animal?.raza ?? "",
    categoria: animal?.categoria ?? "",
    peso: animal?.peso != null ? String(animal.peso) : "",
    fechaNacimiento: animal?.fechaNacimiento ?? "",
    loteId: animal?.loteId ?? loteSel ?? "",
    observaciones: animal?.observaciones ?? "",
  });
  const [form, setForm] = useState(formInicial);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Reset del formulario al abrir el modal: setState-in-effect es el patrón correcto acá.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(formInicial());
       
      setErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, animal?.id]);

  // Validaciones en vivo para el alta (bloqueo, no advertencia).
  const ciiTrim = form.caravana.trim();
  const formatoCII = validarFormatoCII(ciiTrim);
  const ciiLibre = caravanaUnicaActiva(ciiTrim, campoId, db.animales, animal?.id);
  const altaBloqueada = !editMode && (!formatoCII.ok || !ciiLibre.ok);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const caravana = form.caravana.trim();
    if (!editMode) {
      if (!formatoCII.ok) {
        setErr(formatoCII.error!);
        return;
      }
      if (!ciiLibre.ok) {
        setErr(ciiLibre.error!);
        return;
      }
    } else if (!caravana) {
      setErr("La caravana es obligatoria.");
      return;
    }
    const sexoVal =
      form.sexo === "M" || form.sexo === "H" ? (form.sexo as "M" | "H") : undefined;
    const coherencia = validarAltaCoherencia(form.categoria.trim() || undefined, sexoVal);
    if (coherencia) {
      setErr(coherencia);
      return;
    }
    const tempr = identificacionTemprana(form.fechaNacimiento || undefined);
    if (!tempr.ok) {
      setErr(tempr.error!);
      return;
    }

    update((db) => {
      const datos = {
        loteId: form.loteId || undefined,
        caravana,
        nombre: form.nombre.trim() || undefined,
        sexo: sexoVal,
        raza: form.raza.trim() || undefined,
        categoria: form.categoria.trim() || undefined,
        peso: form.peso ? Number(form.peso) : undefined,
        fechaNacimiento: form.fechaNacimiento || undefined,
        observaciones: form.observaciones.trim() || undefined,
      };
      if (editMode) {
        const a = db.animales.find((x) => x.id === animal!.id);
        if (a) {
          const { caravana: _ignorada, ...editables } = datos;
          Object.assign(a, editables, { updatedAt: Date.now() });
        }
      } else {
        db.animales.push({
          id: uid("a_"),
          campoId,
          ...datos,
          estado: "activo",
          activo: true, // baja lógica
          colorCaravana: colorCaravana({
            zonaVacunacionAftosa: campo?.zonaVacunacionAftosa,
          }),
          alertas: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });
    onSaved();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editMode ? `Editar caravana ${animal!.caravana}` : "Nuevo animal"}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Caravana / EID" required>
            <input
              autoFocus={!editMode}
              readOnly={editMode}
              className={`input ${editMode ? "opacity-60 cursor-not-allowed" : ""}`}
              value={form.caravana}
              onChange={(e) => setForm({ ...form, caravana: e.target.value })}
              placeholder="0123456789 (10 dígitos)"
              inputMode="numeric"
              title={editMode ? "La caravana es el ID físico del animal y no se puede modificar." : undefined}
            />
            {editMode ? (
              <div className="text-[11px] text-ink-dim mt-1">
                La caravana identifica físicamente al animal y no se puede cambiar.
              </div>
            ) : (
              ciiTrim.length > 0 && (
                <div className="text-[11px] mt-1 space-y-0.5">
                  <div className={formatoCII.ok ? "text-success" : "text-error"}>
                    {formatoCII.ok ? "✓ formato OK (10 dígitos)" : `✗ ${formatoCII.error}`}
                  </div>
                  {formatoCII.ok && (
                    <div className={ciiLibre.ok ? "text-success" : "text-error"}>
                      {ciiLibre.ok ? "✓ CII libre (no duplicado)" : `✗ ${ciiLibre.error}`}
                    </div>
                  )}
                </div>
              )
            )}
          </Field>
          <Field label="Nombre">
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </Field>
          <Field label="Sexo">
            <select
              className="input"
              value={form.sexo}
              onChange={(e) => setForm({ ...form, sexo: e.target.value })}
            >
              <option value="">—</option>
              <option value="M">Macho</option>
              <option value="H">Hembra</option>
            </select>
          </Field>
          <Field label="Categoría">
            <select
              className="input"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              <option value="">— Sin especificar —</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {/* Conserva una categoría preexistente que no esté en la lista (ej. importada) */}
              {form.categoria && !CATEGORIAS.includes(form.categoria) && (
                <option value={form.categoria}>{form.categoria}</option>
              )}
            </select>
          </Field>
          <Field label="Raza">
            <select
              className="input"
              value={form.raza}
              onChange={(e) => setForm({ ...form, raza: e.target.value })}
            >
              <option value="">— Sin especificar —</option>
              {RAZAS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              {/* Conserva una raza preexistente (ej. importada) que no esté en la lista */}
              {form.raza && !RAZAS.includes(form.raza) && (
                <option value={form.raza}>{form.raza}</option>
              )}
            </select>
          </Field>
          <Field label="Lote">
            <select
              className="input"
              value={form.loteId}
              onChange={(e) => setForm({ ...form, loteId: e.target.value })}
            >
              <option value="">Sin lote</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Peso (kg)">
            <input
              className="input"
              type="number"
              value={form.peso}
              onChange={(e) => setForm({ ...form, peso: e.target.value })}
            />
          </Field>
          <Field label="Fecha de nacimiento">
            <input
              className="input"
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Observaciones">
          <textarea
            className="input min-h-[70px]"
            value={form.observaciones}
            onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
          />
        </Field>
        {err && <div className="text-sm text-error">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancelar
          </button>
          <button
            className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={altaBloqueada}
            title={altaBloqueada ? "Corregí el CII para habilitar el alta." : undefined}
          >
            {editMode ? "Guardar cambios" : "Guardar animal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label block mb-1.5">
        {label}
        {required ? <span className="text-accent"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function AnimalDetalle({
  animal,
  onClose,
  puedeEditar,
  onChange,
}: {
  animal: Animal | null;
  onClose: () => void;
  puedeEditar: boolean;
  onChange: () => void;
}) {
  const { db, user } = useApp();
  const [nuevaAlerta, setNuevaAlerta] = useState<Partial<Alerta>>({
    tipo: "sanitaria",
    titulo: "",
  });
  if (!animal) return null;

  function agregarAlerta() {
    if (!nuevaAlerta.titulo?.trim()) return;
    update((db) => {
      const a = db.animales.find((x) => x.id === animal!.id);
      if (!a) return;
      a.alertas.push({
        id: uid("al_"),
        tipo: (nuevaAlerta.tipo as Alerta["tipo"]) ?? "otra",
        titulo: nuevaAlerta.titulo!.trim(),
        descripcion: nuevaAlerta.descripcion?.trim() || undefined,
        fecha: nuevaAlerta.fecha,
        creadaPor: user!.id,
        createdAt: Date.now(),
        resuelta: false,
      });
      a.updatedAt = Date.now();
    });
    setNuevaAlerta({ tipo: "sanitaria", titulo: "" });
    onChange();
  }

  function toggleAlerta(alertaId: string) {
    update((db) => {
      const a = db.animales.find((x) => x.id === animal!.id);
      const al = a?.alertas.find((al) => al.id === alertaId);
      if (al) al.resuelta = !al.resuelta;
      if (a) a.updatedAt = Date.now();
    });
    onChange();
  }

  function quitarAlerta(alertaId: string) {
    update((db) => {
      const a = db.animales.find((x) => x.id === animal!.id);
      if (a) a.alertas = a.alertas.filter((al) => al.id !== alertaId);
    });
    onChange();
  }

  // animal puede estar desactualizado tras edits — buscar el fresco
  return (
    <AnimatePresence>
      {animal && (
        <Modal open={true} onClose={onClose} size="lg" title={`Caravana ${animal.caravana}`}>
          <FreshAnimal animalId={animal.id}>
            {(fresh) => (
              <div className="space-y-5">
                <AnimalBanner animal={fresh} db={db} />
                {fresh.observaciones && (
                  <div>
                    <div className="label mb-1">Observaciones</div>
                    <div className="text-sm text-ink-muted">{fresh.observaciones}</div>
                  </div>
                )}
                <HistorialTimeline animalId={fresh.id} db={db} caravana={fresh.caravana} />
                <div className="divider" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-heading text-base text-ink">Alertas</h4>
                    <span className="text-xs text-ink-dim">
                      {fresh.alertas.filter((a) => !a.resuelta).length} activas
                    </span>
                  </div>
                  {fresh.alertas.length === 0 ? (
                    <div className="text-sm text-ink-muted">Sin alertas registradas.</div>
                  ) : (
                    <ul className="space-y-2">
                      {fresh.alertas.map((al) => (
                        <li
                          key={al.id}
                          className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                            al.resuelta
                              ? "border-line bg-bg-soft/40 text-ink-dim"
                              : "border-warning/20 bg-warning/5"
                          }`}
                        >
                          <div className="text-sm">
                            <div className="flex items-center gap-2">
                              <span className="chip uppercase text-[10px]">{al.tipo}</span>
                              <span
                                className={
                                  al.resuelta ? "line-through" : "text-ink font-medium"
                                }
                              >
                                {al.titulo}
                              </span>
                            </div>
                            {al.descripcion && (
                              <div className="text-ink-muted text-xs mt-1">
                                {al.descripcion}
                              </div>
                            )}
                            {al.fecha && (
                              <div className="text-ink-dim text-xs mt-1">📅 {al.fecha}</div>
                            )}
                          </div>
                          {puedeEditar && (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => toggleAlerta(al.id)}
                                className="rounded-md border border-line p-1.5 text-ink-muted hover:text-ink hover:bg-bg-soft"
                                title={al.resuelta ? "Marcar pendiente" : "Marcar resuelta"}
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={() => quitarAlerta(al.id)}
                                className="rounded-md border border-line p-1.5 text-ink-dim hover:text-error"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {puedeEditar && (
                    <div className="mt-4 rounded-xl border border-line bg-bg-soft/40 p-3">
                      <div className="text-xs uppercase tracking-wider text-ink-dim mb-2">
                        Nueva alerta
                      </div>
                      <div className="grid sm:grid-cols-[140px_1fr_160px] gap-2">
                        <select
                          className="input"
                          value={nuevaAlerta.tipo}
                          onChange={(e) =>
                            setNuevaAlerta((s) => ({
                              ...s,
                              tipo: e.target.value as Alerta["tipo"],
                            }))
                          }
                        >
                          <option value="sanitaria">Sanitaria</option>
                          <option value="reproductiva">Reproductiva</option>
                          <option value="nutricional">Nutricional</option>
                          <option value="otra">Otra</option>
                        </select>
                        <input
                          className="input"
                          placeholder="Título de la alerta"
                          value={nuevaAlerta.titulo ?? ""}
                          onChange={(e) =>
                            setNuevaAlerta((s) => ({ ...s, titulo: e.target.value }))
                          }
                        />
                        <input
                          className="input"
                          type="date"
                          value={nuevaAlerta.fecha ?? ""}
                          onChange={(e) =>
                            setNuevaAlerta((s) => ({ ...s, fecha: e.target.value }))
                          }
                        />
                      </div>
                      <textarea
                        className="input mt-2 min-h-[60px]"
                        placeholder="Descripción (opcional)"
                        value={nuevaAlerta.descripcion ?? ""}
                        onChange={(e) =>
                          setNuevaAlerta((s) => ({ ...s, descripcion: e.target.value }))
                        }
                      />
                      <div className="flex justify-end mt-2">
                        <button onClick={agregarAlerta} className="btn-primary text-sm">
                          <BellRing size={14} /> Agregar alerta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </FreshAnimal>
        </Modal>
      )}
    </AnimatePresence>
  );
}

function FreshAnimal({
  animalId,
  children,
}: {
  animalId: string;
  children: (a: Animal) => React.ReactNode;
}) {
  const { db } = useApp();
  const a = db.animales.find((x) => x.id === animalId);
  if (!a) return <div className="text-ink-muted text-sm">Animal no encontrado.</div>;
  return <>{children(a)}</>;
}

function Info({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <div className="label mb-0.5">{label}</div>
      <div className="text-ink capitalize">{value ?? "—"}</div>
    </div>
  );
}

function AnimalBanner({
  animal,
  db,
}: {
  animal: Animal;
  db: import("@/lib/types").DBShape;
}) {
  const apt = aptitud(animal);
  const lote = db.lotes.find((l) => l.id === animal.loteId);
  const est = estadoAnimal(animal);
  const estDot =
    est === "activo"
      ? "bg-success"
      : est === "muerto" || est === "egresado"
      ? "bg-error"
      : "bg-warning";
  const aptCls =
    apt.color === "verde" ? "text-success" : apt.color === "amber" ? "text-warning" : "text-error";
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="bg-accent-deep text-white p-4 sm:p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            CII
          </div>
          <div className="font-display text-2xl sm:text-3xl text-white break-all">
            {animal.caravana}
          </div>
          <div className="text-white/80 text-sm mt-0.5">
            {[animal.categoria, animal.raza].filter(Boolean).join(" · ") || "Sin clasificar"}
          </div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
          <span className={`h-2 w-2 rounded-full ${estDot}`} /> Estado: {est}
        </span>
      </div>
      <div className="bg-bg-card grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 sm:p-5">
        <Dato label="Lote actual" valor={lote?.nombre || "Sin lote"} />
        <Dato label="Último peso" valor={animal.peso ? `${animal.peso} kg` : "—"} />
        <div>
          <div className="label mb-1">Aptitud de movimiento</div>
          <div className={`inline-flex items-center gap-1.5 text-sm font-semibold ${aptCls}`}>
            <CheckCircle2 size={15} /> {apt.texto}
          </div>
        </div>
      </div>
      <div className="bg-bg-card flex flex-wrap gap-x-4 gap-y-1 px-4 sm:px-5 pb-4 pt-3 text-xs text-ink-muted border-t border-line/60">
        <span>
          Sexo:{" "}
          <b className="text-ink font-medium">
            {animal.sexo === "M" ? "Macho" : animal.sexo === "H" ? "Hembra" : "—"}
          </b>
        </span>
        <span>
          Nacimiento: <b className="text-ink font-medium">{animal.fechaNacimiento || "—"}</b>
        </span>
        <span>
          Color: <b className="text-ink font-medium capitalize">{animal.colorCaravana || "—"}</b>
        </span>
        {animal.fechaCarenciaHasta && (
          <span className="text-warning font-medium">
            En carencia hasta {animal.fechaCarenciaHasta}
          </span>
        )}
      </div>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <div className="text-ink font-medium">{valor}</div>
    </div>
  );
}

type FiltroHist = "todos" | "sanitario" | "pesaje" | "movimiento";
const NODO: Record<string, { Icon: any; cls: string }> = {
  alta: { Icon: PlusCircle, cls: "border-success/40 text-success bg-success/5" },
  sanitario: { Icon: Syringe, cls: "border-warning/40 text-warning bg-warning/5" },
  pesaje: { Icon: Scale, cls: "border-info/40 text-info bg-info/5" },
  movimiento: { Icon: ArrowRightLeft, cls: "border-line text-ink-muted bg-bg-soft" },
  alerta: { Icon: BellRing, cls: "border-warning/40 text-warning bg-warning/5" },
};
const FILTROS: { key: FiltroHist; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "sanitario", label: "Sanidad" },
  { key: "pesaje", label: "Pesos" },
  { key: "movimiento", label: "Movimientos" },
];

function HistorialTimeline({
  animalId,
  db,
  caravana,
}: {
  animalId: string;
  db: import("@/lib/types").DBShape;
  caravana: string;
}) {
  const [filtro, setFiltro] = useState<FiltroHist>("todos");
  const all = historialDeAnimal(animalId, db);
  const items = filtro === "todos" ? all : all.filter((it) => it.tipo === filtro);

  function exportar() {
    // Pasa por descargarCSV como el resto: aplica el saneo anti-fórmula (el detalle lleva
    // texto libre del usuario) y deja el escapado en manos de Papa, que sabe de comillas
    // y saltos de línea. Antes se armaba el CSV a mano y ninguna de las dos cosas pasaba.
    descargarCSV(
      all.map((it) => ({
        fecha: it.fecha ?? fechaISO(it.fechaHora),
        tipo: it.tipo,
        detalle: `${it.titulo}${it.detalle ? ` — ${it.detalle}` : ""}`,
      })),
      `historial-${caravana}.csv`
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label">Filtros</span>
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                filtro === f.key
                  ? "bg-accent text-white border-accent font-medium"
                  : "border-line text-ink-muted hover:text-ink hover:bg-bg-soft"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {all.length > 0 && (
          <button onClick={exportar} className="btn-ghost text-xs">
            <Download size={13} /> Exportar
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-ink-muted py-4">Sin registros para este filtro.</div>
      ) : (
        <ul>
          {items.map((it, i) => {
            const nodo = NODO[it.tipo] ?? NODO.movimiento;
            const Icon = nodo.Icon;
            return (
              <li key={it.id} className="relative flex gap-4 pb-4 last:pb-0">
                <div className="relative flex flex-col items-center">
                  <div className={`z-10 grid place-items-center w-9 h-9 rounded-lg border ${nodo.cls}`}>
                    <Icon size={16} />
                  </div>
                  {i < items.length - 1 && (
                    <span className="absolute top-9 bottom-0 w-px bg-line" />
                  )}
                </div>
                <div className="flex-1 rounded-xl border border-line bg-bg-card p-3 -mt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-heading text-ink text-sm">{it.titulo}</div>
                    <span className="chip text-[11px] whitespace-nowrap">
                      {it.fecha ?? new Date(it.fechaHora).toLocaleDateString()}
                    </span>
                  </div>
                  {it.detalle && <div className="text-sm text-ink-muted mt-1">{it.detalle}</div>}
                  {it.estadoSincronizacion && it.estadoSincronizacion !== "sincronizado" && (
                    <span className="inline-block mt-2 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-warning">
                      {it.estadoSincronizacion}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ExportarMenu({
  onCSV,
  onXLSX,
}: {
  onCSV: () => void;
  onXLSX: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost text-sm"
        title="Exportar lista filtrada"
      >
        <Download size={14} /> Exportar
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-2 w-48 z-20 overflow-hidden rounded-md border border-line bg-bg-card shadow-pop"
          >
            <button
              onClick={() => {
                onCSV();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-bg/60 text-left"
            >
              <FileText size={14} className="text-accent" /> Exportar a CSV
            </button>
            <button
              onClick={() => {
                onXLSX();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-bg/60 text-left border-t border-line/60"
            >
              <FileSpreadsheet size={14} className="text-accent" /> Exportar a XLSX
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
