"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, MapPin, Users, KeyRound, LogIn } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RoleBadge } from "@/components/RoleBadge";
import { Modal } from "@/components/Modal";
import { GlobalShell } from "@/components/GlobalShell";
import { useApp } from "@/lib/context";
import { codigoCampo, uid, update } from "@/lib/storage";
import { unirmeConCodigo } from "@/lib/colaboracion";
import type { Rol } from "@/lib/types";

export default function DashboardPage() {
  const { db, user, refresh } = useApp();
  const [openNew, setOpenNew] = useState(false);
  const [openJoin, setOpenJoin] = useState(false);

  const campos = useMemo(() => {
    if (!user) return [];
    return db.campos.filter(
      (c) => c.ownerId === user.id || c.miembros.some((m) => m.userId === user.id)
    );
  }, [db, user]);

  function rolDe(campoId: string): Rol {
    const c = db.campos.find((cc) => cc.id === campoId)!;
    if (c.ownerId === user!.id) return "admin";
    return c.miembros.find((m) => m.userId === user!.id)!.rol;
  }

  return (
    <GlobalShell>
      <PageHeader
        icon={MapPin}
        eyebrow={`Hola, ${user?.username ?? ""}`}
        title="Tus campos"
        subtitle="Acá ves los campos donde sos administrador o miembro. Crear un campo te asigna el rol de admin automáticamente."
        actions={
          <>
            <button onClick={() => setOpenJoin(true)} className="btn-ghost text-sm">
              <KeyRound size={15} /> Unirme con código
            </button>
            <button onClick={() => setOpenNew(true)} className="btn-primary text-sm">
              <Plus size={15} /> Nuevo campo
            </button>
          </>
        }
      />

      {campos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-10 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/15">
            <MapPin size={26} />
          </div>
          <div className="font-display text-xl text-ink">Todavía no tenés campos</div>
          <p className="text-ink-muted text-sm mt-1 max-w-sm mx-auto leading-relaxed">
            Un campo es tu establecimiento ganadero. Creá el primero para empezar a cargar
            animales, o unite a uno con el código que te haya compartido un administrador.
          </p>
          <div className="flex justify-center gap-2 mt-5">
            <button onClick={() => setOpenJoin(true)} className="btn-ghost text-sm">
              Unirme con código
            </button>
            <button onClick={() => setOpenNew(true)} className="btn-primary text-sm">
              Crear campo
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campos.map((c, idx) => {
            const rol = rolDe(c.id);
            const totalMiembros = c.miembros.length + 1;
            const totalAnimales = db.animales.filter((a) => a.campoId === c.id).length;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -3 }}
              >
                <Link
                  href={`/campos/${c.id}`}
                  className="card block p-5 hover:border-accent/40 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-xl text-ink">{c.nombre}</div>
                      {c.descripcion && (
                        <div className="text-sm text-ink-muted mt-1 line-clamp-2">
                          {c.descripcion}
                        </div>
                      )}
                    </div>
                    <RoleBadge rol={rol} />
                  </div>
                  <div className="mt-5 flex items-center gap-4 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={13} /> {totalMiembros} miembro
                      {totalMiembros !== 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={13} /> {totalAnimales} animal
                      {totalAnimales !== 1 ? "es" : ""}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="chip font-mono">{c.codigo}</span>
                    <span className="text-xs text-ink-dim">Entrar →</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      <NewCampoModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        onCreate={() => {
          setOpenNew(false);
          refresh();
        }}
      />
      <JoinModal
        open={openJoin}
        onClose={() => setOpenJoin(false)}
        onJoined={() => {
          setOpenJoin(false);
          refresh();
        }}
      />
    </GlobalShell>
  );
}

function NewCampoModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
}) {
  const { user } = useApp();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setErr("El nombre es obligatorio.");
      return;
    }
    update((db) => {
      db.campos.push({
        id: uid("c_"),
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        codigo: codigoCampo(),
        ownerId: user!.id,
        miembros: [],
        createdAt: Date.now(),
      });
    });
    setNombre("");
    setDescripcion("");
    onCreate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo campo">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label block mb-1.5">Nombre del campo</label>
          <input
            autoFocus
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="ej: La Esperanza"
          />
        </div>
        <div>
          <label className="label block mb-1.5">Descripción (opcional)</label>
          <textarea
            className="input min-h-[80px]"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ubicación, hectáreas, notas…"
          />
        </div>
        {err && <div className="text-sm text-error">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancelar
          </button>
          <button className="btn-primary text-sm">
            <Plus size={14} /> Crear campo
          </button>
        </div>
      </form>
    </Modal>
  );
}

function JoinModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setCargando(true);
    const r = await unirmeConCodigo(codigo);
    setCargando(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setOk("Te uniste al campo como sólo vista. Pedile al Productor que te cambie el rol si necesitás más permisos.");
    setCodigo("");
    onJoined();
  }

  return (
    <Modal open={open} onClose={onClose} title="Unirme a un campo">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-muted">
          Ingresá el código de 6 caracteres que te compartió un admin.
        </p>
        <input
          autoFocus
          className="input font-mono tracking-[0.4em] uppercase text-center text-lg"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="ABC123"
        />
        {err && <div className="text-sm text-error">{err}</div>}
        {ok && <div className="text-sm text-accent-soft">{ok}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cerrar
          </button>
          <button className="btn-primary text-sm" disabled={cargando}>
            <LogIn size={14} /> {cargando ? "Uniéndome…" : "Unirme"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
