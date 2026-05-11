"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Trash2, Tags, BellRing, X, Check } from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { uid, update } from "@/lib/storage";
import { Modal } from "@/components/Modal";
import type { Animal, Alerta } from "@/lib/types";

export default function AnimalesPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const { db, user, refresh } = useApp();
  const rol = rolEnCampo(user!.id, id);
  const puedeEditar = rol === "admin" || rol === "usuario";

  const [filtro, setFiltro] = useState("");
  const [loteSel, setLoteSel] = useState(sp.get("lote") ?? "");
  const [open, setOpen] = useState(false);
  const [detalle, setDetalle] = useState<Animal | null>(null);

  const lotes = db.lotes.filter((l) => l.campoId === id);
  const animales = useMemo(() => {
    let list = db.animales.filter((a) => a.campoId === id);
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
    if (!confirm("¿Eliminar este animal?")) return;
    update((db) => {
      db.animales = db.animales.filter((a) => a.id !== animalId);
    });
    refresh();
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
        {puedeEditar && (
          <button onClick={() => setOpen(true)} className="btn-primary text-sm">
            <Plus size={14} /> Nuevo animal
          </button>
        )}
      </div>

      {animales.length === 0 ? (
        <div className="card p-10 text-center text-ink-muted">
          <Tags className="mx-auto mb-3 text-ink-dim" />
          No hay animales que coincidan.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.6fr_auto] gap-3 px-5 py-3 border-b border-line text-xs uppercase tracking-wider text-ink-dim">
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
              return (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.015 }}
                  className="grid grid-cols-2 md:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_0.8fr_0.6fr_auto] gap-3 px-5 py-3 border-b border-line/60 last:border-0 hover:bg-bg-soft/60 transition cursor-pointer"
                  onClick={() => setDetalle(a)}
                >
                  <div className="font-mono text-accent">{a.caravana}</div>
                  <div className="text-ink">{a.nombre || "—"}</div>
                  <div className="text-ink-muted">{a.categoria || "—"}</div>
                  <div className="text-ink-muted">{a.raza || "—"}</div>
                  <div className="text-ink-muted">{lote?.nombre || "—"}</div>
                  <div>
                    {activas > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-300 text-xs">
                        <BellRing size={12} />
                        {activas}
                      </span>
                    ) : (
                      <span className="text-ink-dim text-xs">—</span>
                    )}
                  </div>
                  {puedeEditar ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminar(a.id);
                      }}
                      className="text-ink-dim hover:text-red-300 justify-self-end"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : (
                    <span />
                  )}
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}

      <NuevoAnimalModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={() => {
          setOpen(false);
          refresh();
        }}
        campoId={id}
        loteSel={loteSel && loteSel !== "_sin" ? loteSel : undefined}
      />

      <AnimalDetalle
        animal={detalle}
        onClose={() => setDetalle(null)}
        puedeEditar={!!puedeEditar}
        onChange={refresh}
      />
    </div>
  );
}

function NuevoAnimalModal({
  open,
  onClose,
  onCreate,
  campoId,
  loteSel,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  campoId: string;
  loteSel?: string;
}) {
  const { db } = useApp();
  const lotes = db.lotes.filter((l) => l.campoId === campoId);
  const [form, setForm] = useState({
    caravana: "",
    nombre: "",
    sexo: "",
    raza: "",
    categoria: "",
    peso: "",
    fechaNacimiento: "",
    loteId: loteSel ?? "",
    observaciones: "",
  });
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const caravana = form.caravana.trim();
    if (!caravana) {
      setErr("La caravana es obligatoria.");
      return;
    }
    let duplicado = false;
    update((db) => {
      const dup = db.animales.find(
        (a) => a.campoId === campoId && a.caravana === caravana
      );
      if (dup) {
        duplicado = true;
        return;
      }
      db.animales.push({
        id: uid("a_"),
        campoId,
        loteId: form.loteId || undefined,
        caravana,
        nombre: form.nombre.trim() || undefined,
        sexo: form.sexo === "M" || form.sexo === "H" ? (form.sexo as "M" | "H") : undefined,
        raza: form.raza.trim() || undefined,
        categoria: form.categoria.trim() || undefined,
        peso: form.peso ? Number(form.peso) : undefined,
        fechaNacimiento: form.fechaNacimiento || undefined,
        observaciones: form.observaciones.trim() || undefined,
        alertas: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    if (duplicado) {
      setErr("Ya existe un animal con esa caravana en este campo.");
      return;
    }
    onCreate();
    setForm({
      caravana: "",
      nombre: "",
      sexo: "",
      raza: "",
      categoria: "",
      peso: "",
      fechaNacimiento: "",
      loteId: loteSel ?? "",
      observaciones: "",
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo animal" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Caravana / RFID" required>
            <input
              autoFocus
              className="input"
              value={form.caravana}
              onChange={(e) => setForm({ ...form, caravana: e.target.value })}
              placeholder="982000123…"
            />
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
            <input
              className="input"
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              placeholder="Vacas, Toros…"
            />
          </Field>
          <Field label="Raza">
            <input
              className="input"
              value={form.raza}
              onChange={(e) => setForm({ ...form, raza: e.target.value })}
              placeholder="Angus, Hereford…"
            />
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
        {err && <div className="text-sm text-red-300">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancelar
          </button>
          <button className="btn-primary text-sm">Guardar animal</button>
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
  const { user } = useApp();
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <Info label="Nombre" value={fresh.nombre} />
                  <Info label="Sexo" value={fresh.sexo === "M" ? "Macho" : fresh.sexo === "H" ? "Hembra" : "—"} />
                  <Info label="Categoría" value={fresh.categoria} />
                  <Info label="Raza" value={fresh.raza} />
                  <Info label="Peso" value={fresh.peso ? `${fresh.peso} kg` : undefined} />
                  <Info label="Nacimiento" value={fresh.fechaNacimiento} />
                </div>
                {fresh.observaciones && (
                  <div>
                    <div className="label mb-1">Observaciones</div>
                    <div className="text-sm text-ink-muted">{fresh.observaciones}</div>
                  </div>
                )}
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
                              : "border-amber-300/20 bg-amber-300/5"
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
                                className="rounded-md border border-line p-1.5 text-ink-dim hover:text-red-300"
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
      <div className="text-ink">{value ?? "—"}</div>
    </div>
  );
}
