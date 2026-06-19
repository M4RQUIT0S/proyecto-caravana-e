"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Plus, Trash2, Send } from "lucide-react";
import { useApp } from "@/lib/context";
import { rolEnCampo } from "@/lib/auth";
import { uid, update } from "@/lib/storage";
import { RoleBadge } from "@/components/RoleBadge";
import { TonoBadge } from "@/components/Tono";
import { Modal } from "@/components/Modal";
import { PERMISOS_OPERADOR_DEFAULT, ROL_LABEL } from "@/lib/permisos";
import type { PermisosOperador, Rol } from "@/lib/types";

const roles: Rol[] = ["admin", "operador", "usuario", "vista"];

const PERMISO_LABEL: { key: keyof PermisosOperador; label: string }[] = [
  { key: "capturar", label: "Capturar en manga" },
  { key: "sanidad", label: "Registrar sanidad" },
  { key: "pesaje", label: "Registrar pesaje" },
  { key: "movimiento", label: "Registrar movimientos" },
];

const DENEGADAS_LABEL = ["Ver costos", "Reportes", "Sincronizar SENASA", "Administrar"];

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
      if (m) {
        m.rol = nuevo;
        // Al pasar a Operador delegado, se inicializan permisos acotados.
        if (nuevo === "operador" && !m.permisos) m.permisos = { ...PERMISOS_OPERADOR_DEFAULT };
      }
    });
    refresh();
  }

  function setPermiso(userId: string, key: keyof PermisosOperador, value: boolean) {
    update((db) => {
      const c = db.campos.find((c) => c.id === id);
      const m = c?.miembros.find((m) => m.userId === userId);
      if (m) {
        m.permisos = { ...PERMISOS_OPERADOR_DEFAULT, ...(m.permisos ?? {}), [key]: value };
      }
    });
    refresh();
  }

  function quitar(userId: string) {
    // Baja lógica: el miembro queda inactivo pero conserva trazabilidad.
    if (!confirm("¿Dar de baja a este miembro? Queda inactivo (baja lógica).")) return;
    update((db) => {
      const c = db.campos.find((c) => c.id === id);
      const m = c?.miembros.find((m) => m.userId === userId);
      if (m) m.activo = false;
    });
    refresh();
  }

  function reactivar(userId: string) {
    update((db) => {
      const c = db.campos.find((c) => c.id === id);
      const m = c?.miembros.find((m) => m.userId === userId);
      if (m) m.activo = true;
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
                permisos={m.permisos}
                activo={m.activo !== false}
                esAdmin={esAdmin}
                onCambiarRol={
                  esAdmin ? (r) => cambiarRol(m.user!.id, r) : undefined
                }
                onSetPermiso={esAdmin ? (k, v) => setPermiso(m.user!.id, k, v) : undefined}
                onQuitar={esAdmin ? () => quitar(m.user!.id) : undefined}
                onReactivar={esAdmin ? () => reactivar(m.user!.id) : undefined}
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
                      className="text-ink-dim hover:text-error"
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
  permisos,
  activo = true,
  esAdmin,
  onCambiarRol,
  onSetPermiso,
  onQuitar,
  onReactivar,
}: {
  username: string;
  email: string;
  rol: Rol;
  tag?: string;
  permisos?: PermisosOperador;
  activo?: boolean;
  esAdmin?: boolean;
  onCambiarRol?: (r: Rol) => void;
  onSetPermiso?: (k: keyof PermisosOperador, v: boolean) => void;
  onQuitar?: () => void;
  onReactivar?: () => void;
}) {
  const efectivos = { ...PERMISOS_OPERADOR_DEFAULT, ...(permisos ?? {}) };
  return (
    <li className={`px-5 py-3 border-b border-line/60 last:border-0 ${!activo ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-ink text-sm flex items-center gap-2">
            {username}
            {tag && <span className="chip text-[10px]">{tag}</span>}
            {!activo && <TonoBadge tono="error">inactivo</TonoBadge>}
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
                  {ROL_LABEL[r]}
                </option>
              ))}
            </select>
          ) : (
            <RoleBadge rol={rol} />
          )}
          {activo && onQuitar && (
            <button onClick={onQuitar} className="text-ink-dim hover:text-error" title="Dar de baja">
              <Trash2 size={15} />
            </button>
          )}
          {!activo && onReactivar && (
            <button onClick={onReactivar} className="text-ink-dim hover:text-success text-xs">
              Reactivar
            </button>
          )}
        </div>
      </div>

      {rol === "operador" && activo && (
        <div className="mt-3 rounded-xl border border-line bg-bg-soft/40 p-3">
          <div className="text-[11px] uppercase tracking-wide text-ink-dim mb-2">
            Permisos del Operador delegado
          </div>
          <div className="flex flex-wrap gap-3">
            {PERMISO_LABEL.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 text-xs text-ink">
                <input
                  type="checkbox"
                  className="accent-accent"
                  checked={efectivos[key]}
                  disabled={!esAdmin || !onSetPermiso}
                  onChange={(e) => onSetPermiso?.(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-ink-dim">
            Denegado siempre: {DENEGADAS_LABEL.join(" · ")}.
          </div>
        </div>
      )}
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
          <div className="grid grid-cols-2 gap-2">
            {roles.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRol(r)}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  rol === r
                    ? "border-accent bg-accent/10 text-ink"
                    : "border-line text-ink-muted hover:text-ink"
                }`}
              >
                {ROL_LABEL[r]}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-dim mt-2">
            <strong className="text-ink-muted">Productor</strong>: control total ·{" "}
            <strong className="text-ink-muted">Operador delegado</strong>: captura en manga con
            permisos acotados (sin costos, reportes ni SENASA) ·{" "}
            <strong className="text-ink-muted">Usuario</strong>: opera y consulta ·{" "}
            <strong className="text-ink-muted">Sólo lectura</strong>: consulta.
          </p>
        </div>
        {err && <div className="text-sm text-error">{err}</div>}
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
