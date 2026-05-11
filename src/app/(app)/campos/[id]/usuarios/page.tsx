"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Plus, Trash2, Send } from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { uid, update } from "@/lib/storage";
import { RoleBadge } from "@/components/RoleBadge";
import { Modal } from "@/components/Modal";
import type { Rol } from "@/lib/types";

const roles: Rol[] = ["admin", "usuario", "vista"];

export default function UsuariosPage() {
  const { id } = useParams<{ id: string }>();
  const { db, user, refresh } = useApp();
  const campo = db.campos.find((c) => c.id === id)!;
  const rolPropio = rolEnCampo(user!.id, id);
  const esAdmin = rolPropio === "admin";
  const [openInv, setOpenInv] = useState(false);

  const owner = db.usuarios.find((u) => u.id === campo.ownerId);
  const miembros = campo.miembros
    .map((m) => ({ ...m, user: db.usuarios.find((u) => u.id === m.userId) }))
    .filter((m) => m.user);
  const invitaciones = db.invitaciones.filter(
    (i) => i.campoId === id && i.estado === "pendiente"
  );

  function cambiarRol(userId: string, nuevo: Rol) {
    update((db) => {
      const c = db.campos.find((c) => c.id === id);
      const m = c?.miembros.find((m) => m.userId === userId);
      if (m) m.rol = nuevo;
    });
    refresh();
  }

  function quitar(userId: string) {
    if (!confirm("¿Quitar este miembro del campo?")) return;
    update((db) => {
      const c = db.campos.find((c) => c.id === id);
      if (c) c.miembros = c.miembros.filter((m) => m.userId !== userId);
    });
    refresh();
  }

  function cancelarInv(invId: string) {
    update((db) => {
      db.invitaciones = db.invitaciones.filter((i) => i.id !== invId);
    });
    refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-ink-muted max-w-xl">
          Invitá usuarios por correo o compartí el código del campo (
          <code className="font-mono">{campo.codigo}</code>). Como admin podés cambiar
          roles y quitar miembros.
        </p>
        {esAdmin && (
          <button onClick={() => setOpenInv(true)} className="btn-primary text-sm">
            <Plus size={14} /> Invitar
          </button>
        )}
      </div>

      <section className="card overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-line text-xs uppercase tracking-wider text-ink-dim">
          Miembros
        </div>
        <ul>
          <Miembro
            key={owner!.id}
            username={owner!.username}
            email={owner!.email}
            rol="admin"
            tag="Dueño"
          />
          {miembros.map((m, idx) => (
            <motion.div
              key={m.user!.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.02 }}
            >
              <Miembro
                username={m.user!.username}
                email={m.user!.email}
                rol={m.rol}
                onCambiarRol={
                  esAdmin ? (r) => cambiarRol(m.user!.id, r) : undefined
                }
                onQuitar={esAdmin ? () => quitar(m.user!.id) : undefined}
              />
            </motion.div>
          ))}
        </ul>
      </section>

      <section className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-line text-xs uppercase tracking-wider text-ink-dim">
          Invitaciones pendientes
        </div>
        {invitaciones.length === 0 ? (
          <div className="px-5 py-6 text-sm text-ink-muted">
            No hay invitaciones pendientes.
          </div>
        ) : (
          <ul>
            {invitaciones.map((inv) => (
              <li
                key={inv.id}
                className="px-5 py-3 border-b border-line/60 last:border-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-ink-dim" />
                  <div>
                    <div className="text-ink text-sm">{inv.email}</div>
                    <div className="text-xs text-ink-dim">
                      Enviada {new Date(inv.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RoleBadge rol={inv.rol} />
                  {esAdmin && (
                    <button
                      onClick={() => cancelarInv(inv.id)}
                      className="text-ink-dim hover:text-red-300"
                      title="Cancelar invitación"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InvitarModal
        open={openInv}
        onClose={() => setOpenInv(false)}
        campoId={id}
        onDone={refresh}
      />
    </div>
  );
}

function Miembro({
  username,
  email,
  rol,
  tag,
  onCambiarRol,
  onQuitar,
}: {
  username: string;
  email: string;
  rol: Rol;
  tag?: string;
  onCambiarRol?: (r: Rol) => void;
  onQuitar?: () => void;
}) {
  return (
    <li className="px-5 py-3 border-b border-line/60 last:border-0 flex items-center justify-between gap-3">
      <div>
        <div className="text-ink text-sm flex items-center gap-2">
          {username}
          {tag && <span className="chip text-[10px]">{tag}</span>}
        </div>
        <div className="text-xs text-ink-dim">{email}</div>
      </div>
      <div className="flex items-center gap-2">
        {onCambiarRol ? (
          <select
            value={rol}
            onChange={(e) => onCambiarRol(e.target.value as Rol)}
            className="rounded-lg bg-bg-soft border border-line px-2 py-1 text-xs text-ink"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <RoleBadge rol={rol} />
        )}
        {onQuitar && (
          <button
            onClick={onQuitar}
            className="text-ink-dim hover:text-red-300"
            title="Quitar"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </li>
  );
}

function InvitarModal({
  open,
  onClose,
  campoId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  campoId: string;
  onDone: () => void;
}) {
  const { user, db } = useApp();
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("usuario");
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    const target = email.trim().toLowerCase();
    if (!/^.+@.+\..+$/.test(target)) {
      setErr("Ingresá un correo válido.");
      return;
    }
    const yaInvitado = db.invitaciones.find(
      (i) => i.campoId === campoId && i.email === target && i.estado === "pendiente"
    );
    if (yaInvitado) {
      setErr("Ya hay una invitación pendiente para ese correo.");
      return;
    }
    const usuario = db.usuarios.find((u) => u.email === target);
    const campo = db.campos.find((c) => c.id === campoId)!;
    if (usuario && (campo.ownerId === usuario.id || campo.miembros.some((m) => m.userId === usuario.id))) {
      setErr("Ese usuario ya forma parte del campo.");
      return;
    }
    update((db) => {
      db.invitaciones.push({
        id: uid("i_"),
        campoId,
        email: target,
        rol,
        invitadoPor: user!.id,
        estado: "pendiente",
        createdAt: Date.now(),
      });
    });
    setInfo(
      usuario
        ? `Invitación enviada. ${usuario.username} la verá al iniciar sesión.`
        : `Invitación creada para ${target}. Cuando esa persona se registre con ese correo, podrá aceptar la invitación.`
    );
    setEmail("");
    onDone();
  }

  return (
    <Modal open={open} onClose={onClose} title="Invitar usuario">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label block mb-1.5">Correo electrónico</label>
          <input
            autoFocus
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@correo.com"
          />
        </div>
        <div>
          <label className="label block mb-1.5">Rol</label>
          <div className="grid grid-cols-3 gap-2">
            {roles.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRol(r)}
                className={`rounded-xl border px-3 py-2 text-sm capitalize transition ${
                  rol === r
                    ? "border-accent bg-accent/10 text-ink"
                    : "border-line text-ink-muted hover:text-ink"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-dim mt-2">
            <strong className="text-ink-muted">Admin</strong>: control total ·{" "}
            <strong className="text-ink-muted">Usuario</strong>: agrega animales y
            alertas · <strong className="text-ink-muted">Vista</strong>: sólo
            lectura.
          </p>
        </div>
        {err && <div className="text-sm text-red-300">{err}</div>}
        {info && <div className="text-sm text-accent-soft">{info}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cerrar
          </button>
          <button className="btn-primary text-sm">
            <Send size={14} /> Enviar invitación
          </button>
        </div>
      </form>
    </Modal>
  );
}
