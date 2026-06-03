"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Mail, Check, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { RoleBadge } from "@/components/RoleBadge";
import { useApp } from "@/lib/context";
import { aceptarInvitacion, rechazarInvitacion } from "@/lib/colaboracion";

export default function InvitacionesPage() {
  const { db, user, refresh } = useApp();

  const invitaciones = useMemo(() => {
    if (!user) return [];
    return db.invitaciones.filter(
      (i) => i.estado === "pendiente" && i.email === user.email
    );
  }, [db, user]);

  async function aceptar(id: string) {
    const r = await aceptarInvitacion(id);
    if (!r.ok) alert(r.error);
    refresh();
  }

  async function rechazar(id: string) {
    await rechazarInvitacion(id);
    refresh();
  }

  return (
    <div>
      <PageHeader
        eyebrow="Bandeja"
        title="Invitaciones"
        subtitle="Acá ves los campos a los que te invitaron usando tu correo."
      />

      {invitaciones.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card p-10 text-center text-ink-muted"
        >
          <Mail className="mx-auto mb-3 text-ink-dim" />
          No tenés invitaciones pendientes.
        </motion.div>
      ) : (
        <ul className="space-y-3">
          {invitaciones.map((inv, idx) => {
            const campo = db.campos.find((c) => c.id === inv.campoId);
            const invitador = db.usuarios.find((u) => u.id === inv.invitadoPor);
            return (
              <motion.li
                key={inv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div>
                  <div className="font-display text-xl text-ink">
                    {campo?.nombre ?? "Campo"}
                  </div>
                  <div className="text-sm text-ink-muted mt-1">
                    Invitado por{" "}
                    <span className="text-ink">
                      {invitador?.username ?? "alguien"}
                    </span>{" "}
                    como <RoleBadge rol={inv.rol} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => aceptar(inv.id)}
                    className="btn-primary text-sm"
                  >
                    <Check size={14} /> Aceptar
                  </button>
                  <button
                    onClick={() => rechazar(inv.id)}
                    className="btn-ghost text-sm"
                  >
                    <X size={14} /> Rechazar
                  </button>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
