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
} from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { uid, update } from "@/lib/storage";
import { Modal } from "@/components/Modal";
import { exportarAnimalesCSV, exportarAnimalesXLSX } from "@/lib/export";
import {
  caravanaUnicaActiva,
  colorCaravana,
  esActivo,
  identificacionTemprana,
  validarFormatoCII,
} from "@/lib/reglas";
import { validarAltaCoherencia, historialDeAnimal, aptitud } from "@/lib/eventos";
import { estado as estadoAnimal } from "@/lib/reglas";
import type { Animal, Alerta } from "@/lib/types";

// Razas/biotipos disponibles en el desplegable del formulario de animal.
const RAZAS = [
  "Angus",
  "Hereford",
  "Shorthorn",
  "Limousin",
  "Charolais",
  "Fleckvieh / Simmental",
  "Limangus",
  "Brangus",
  "Braford",
  "Brahman",
  "Bonsmara",
  "Holando Argentino",
  "Jersey",
  "Pardo Suizo",
  "Wagyu",
  "Búfalo",
];

// Categorías disponibles en el desplegable del formulario de animal.
const CATEGORIAS = [
  "Ternero/a",
  "Novillito",
  "Novillo",
  "Macho entero joven (MEJ)",
  "Toro",
  "Vaquillona",
  "Vaca",
];

export default function AnimalesPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { db, user, refresh } = useApp();
  const rol = rolEnCampo(user!.id, id);
  const puedeCrear = rol === "admin" || rol === "usuario";
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
    if (!confirm("¿Dar de baja este animal? Queda inactivo pero conserva su historial (RN07).")) return;
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
                ? "grid-cols-[36px_1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.6fr_auto]"
                : "grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.6fr_auto]"
            } gap-3 px-5 py-3 border-b border-line text-xs uppercase tracking-wider text-ink-dim`}
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
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.015 }}
                  className={`grid grid-cols-2 ${
                    esAdmin
                      ? "md:grid-cols-[36px_1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.6fr_auto]"
                      : "md:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.6fr_auto]"
                  } gap-3 px-5 py-3 border-b border-line/60 last:border-0 hover:bg-bg-soft/60 transition cursor-pointer ${
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
                  <div className="font-mono text-accent">{a.caravana}</div>
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
                </motion.li>
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
      setForm(formInicial());
      setErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, animal?.id]);

  // Validaciones en vivo para el alta (RNF-03: bloqueo, no advertencia).
  const ciiTrim = form.caravana.trim();
  const formatoCII = validarFormatoCII(ciiTrim); // RN01
  const ciiLibre = caravanaUnicaActiva(ciiTrim, campoId, db.animales, animal?.id); // RN02
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
    const coherencia = validarAltaCoherencia(form.categoria.trim() || undefined, sexoVal); // RN19
    if (coherencia) {
      setErr(coherencia);
      return;
    }
    const tempr = identificacionTemprana(form.fechaNacimiento || undefined); // RN05
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
          estado: "activo", // RN14
          activo: true, // RN07 (baja lógica)
          colorCaravana: colorCaravana({
            zonaVacunacionAftosa: campo?.zonaVacunacionAftosa,
          }), // RN04
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
                    {formatoCII.ok ? "✓ formato OK (10 dígitos, RN01)" : `✗ ${formatoCII.error}`}
                  </div>
                  {formatoCII.ok && (
                    <div className={ciiLibre.ok ? "text-success" : "text-error"}>
                      {ciiLibre.ok ? "✓ CII libre (no duplicado, RN02)" : `✗ ${ciiLibre.error}`}
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
            title={altaBloqueada ? "Corregí el CII para habilitar el alta (RNF-03)." : undefined}
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
                <SemaforoAptitud animal={fresh} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <Info label="Nombre" value={fresh.nombre} />
                  <Info label="Sexo" value={fresh.sexo === "M" ? "Macho" : fresh.sexo === "H" ? "Hembra" : "—"} />
                  <Info label="Categoría" value={fresh.categoria} />
                  <Info label="Raza / biotipo" value={fresh.raza} />
                  <Info label="Peso" value={fresh.peso ? `${fresh.peso} kg` : undefined} />
                  <Info label="Estado" value={estadoAnimal(fresh)} />
                  <Info label="Color caravana" value={fresh.colorCaravana} />
                  <Info label="Nacimiento" value={fresh.fechaNacimiento} />
                  <Info
                    label="Carencia"
                    value={fresh.fechaCarenciaHasta ? `hasta ${fresh.fechaCarenciaHasta}` : undefined}
                  />
                </div>
                {fresh.observaciones && (
                  <div>
                    <div className="label mb-1">Observaciones</div>
                    <div className="text-sm text-ink-muted">{fresh.observaciones}</div>
                  </div>
                )}
                <div className="divider" />
                <HistorialTimeline animalId={fresh.id} db={db} caravana={fresh.caravana} />
                <div className="divider" />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-display text-lg text-ink">Alertas</h4>
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

function SemaforoAptitud({ animal }: { animal: Animal }) {
  const apt = aptitud(animal);
  const cls =
    apt.color === "verde"
      ? "border-success/30 bg-success/5 text-success"
      : apt.color === "amber"
      ? "border-warning/30 bg-warning/5 text-warning"
      : "border-error/30 bg-error/5 text-error";
  const dot =
    apt.color === "verde" ? "bg-success" : apt.color === "amber" ? "bg-warning" : "bg-error";
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-sm flex items-center gap-2 ${cls}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
      Aptitud: {apt.texto}
    </div>
  );
}

const ICONO_HISTORIAL: Record<string, string> = {
  alta: "🐮",
  sanitario: "💉",
  pesaje: "⚖️",
  movimiento: "🔁",
  alerta: "🔔",
};

function HistorialTimeline({
  animalId,
  db,
  caravana,
}: {
  animalId: string;
  db: import("@/lib/types").DBShape;
  caravana: string;
}) {
  const items = historialDeAnimal(animalId, db);

  function exportar() {
    const filas = items.map((it) => ({
      fecha: it.fecha ?? new Date(it.fechaHora).toISOString().slice(0, 10),
      tipo: it.tipo,
      detalle: `${it.titulo}${it.detalle ? ` — ${it.detalle}` : ""}`.replace(/"/g, "'"),
    }));
    const header = "fecha,tipo,detalle";
    const cuerpo = filas.map((f) => `${f.fecha},${f.tipo},"${f.detalle}"`).join("\n");
    const blob = new Blob([`﻿${header}\n${cuerpo}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial-${caravana}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-display text-lg text-ink">Historial individual</h4>
        {items.length > 0 && (
          <button onClick={exportar} className="btn-ghost text-xs">
            <Download size={13} /> Exportar historial
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-ink-muted">Sin eventos registrados todavía.</div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it) => (
            <li key={it.id} className="flex gap-3 text-sm">
              <span className="text-lg leading-none">{ICONO_HISTORIAL[it.tipo] ?? "•"}</span>
              <div className="flex-1 border-b border-line/50 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink">{it.titulo}</span>
                  <span className="text-ink-dim text-xs whitespace-nowrap">
                    {it.fecha ?? new Date(it.fechaHora).toLocaleDateString()}
                  </span>
                </div>
                {it.detalle && <div className="text-ink-muted text-xs mt-0.5">{it.detalle}</div>}
                {it.estadoSincronizacion && it.estadoSincronizacion !== "sincronizado" && (
                  <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-warning/80">
                    {it.estadoSincronizacion}
                  </span>
                )}
              </div>
            </li>
          ))}
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
            className="absolute right-0 mt-2 w-48 rounded-xl border border-line bg-bg-soft shadow-lg z-20 overflow-hidden"
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
