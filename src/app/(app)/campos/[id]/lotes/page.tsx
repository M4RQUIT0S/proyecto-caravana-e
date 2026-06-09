"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Layers, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { uid, update } from "@/lib/storage";
import { RAZAS, CATEGORIAS } from "@/lib/clasificacion";
import { Modal } from "@/components/Modal";

export default function LotesPage() {
  const { id } = useParams<{ id: string }>();
  const { db, user, refresh } = useApp();
  const lotes = db.lotes.filter((l) => l.campoId === id);
  const rol = rolEnCampo(user!.id, id);
  const puedeEditar = rol === "admin" || rol === "usuario";
  const [open, setOpen] = useState(false);

  function eliminar(loteId: string) {
    if (!confirm("¿Eliminar este lote? Los animales quedarán sin lote asignado."))
      return;
    update((db) => {
      db.lotes = db.lotes.filter((l) => l.id !== loteId);
      for (const a of db.animales) {
        if (a.loteId === loteId) a.loteId = undefined;
      }
    });
    refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-ink-muted max-w-xl">
          Agrupá animales por categoría y raza. Los lotes son útiles cuando hay
          distintas líneas dentro del mismo campo.
        </p>
        {puedeEditar && (
          <button onClick={() => setOpen(true)} className="btn-primary text-sm">
            <Plus size={14} /> Nuevo lote
          </button>
        )}
      </div>

      {lotes.length === 0 ? (
        <div className="card p-10 text-center text-ink-muted">
          <Layers className="mx-auto mb-3 text-ink-dim" />
          Todavía no hay lotes en este campo.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lotes.map((l, idx) => {
            const n = db.animales.filter((a) => a.loteId === l.id).length;
            return (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="card p-5 hover:border-accent/30 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-xl text-ink">{l.nombre}</div>
                    <div className="text-sm text-ink-muted">
                      {l.categoria} · {l.raza}
                    </div>
                  </div>
                  {puedeEditar && (
                    <button
                      onClick={() => eliminar(l.id)}
                      className="text-ink-dim hover:text-error"
                      title="Eliminar lote"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {l.descripcion && (
                  <p className="text-sm text-ink-muted mt-3 line-clamp-2">
                    {l.descripcion}
                  </p>
                )}
                <div className="mt-5 flex items-center justify-between">
                  <span className="chip">{n} animales</span>
                  <Link
                    href={`/campos/${id}/animales?lote=${l.id}`}
                    className="text-xs text-accent hover:underline"
                  >
                    Ver animales →
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <NuevoLoteModal
        open={open}
        onClose={() => setOpen(false)}
        onCreate={() => {
          setOpen(false);
          refresh();
        }}
        campoId={id}
      />
    </div>
  );
}

function NuevoLoteModal({
  open,
  onClose,
  onCreate,
  campoId,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
  campoId: string;
}) {
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [raza, setRaza] = useState("");
  const [descripcion, setDescripcion] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !categoria.trim() || !raza.trim()) return;
    update((db) => {
      db.lotes.push({
        id: uid("l_"),
        campoId,
        nombre: nombre.trim(),
        categoria: categoria.trim(),
        raza: raza.trim(),
        descripcion: descripcion.trim() || undefined,
        createdAt: Date.now(),
      });
    });
    setNombre("");
    setCategoria("");
    setRaza("");
    setDescripcion("");
    onCreate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo lote">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label block mb-1.5">Nombre</label>
          <input
            autoFocus
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="ej: Vacas Angus paridas"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1.5">Categoría</label>
            <select
              className="input"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              <option value="">— Elegí una categoría —</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label block mb-1.5">Raza</label>
            <select
              className="input"
              value={raza}
              onChange={(e) => setRaza(e.target.value)}
            >
              <option value="">— Elegí una raza —</option>
              {RAZAS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label block mb-1.5">Descripción</label>
          <textarea
            className="input min-h-[70px]"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Notas opcionales del lote"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancelar
          </button>
          <button className="btn-primary text-sm">Crear lote</button>
        </div>
      </form>
    </Modal>
  );
}
