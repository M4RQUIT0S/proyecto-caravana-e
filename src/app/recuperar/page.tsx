"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { enviarRecuperacion } from "@/lib/auth";

export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await enviarRecuperacion(email);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setEnviado(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="card w-full max-w-md p-7 sm:p-9"
      >
        <div className="flex items-center justify-center mb-6">
          <Logo />
        </div>

        {enviado ? (
          <div className="text-center">
            <div className="flex justify-center mb-4 text-success">
              <MailCheck size={40} />
            </div>
            <h1 className="font-display text-2xl text-ink">Revisá tu correo</h1>
            <p className="text-ink-muted text-sm mt-2">
              Si <span className="text-ink">{email}</span> está registrado, te enviamos un
              enlace para crear una contraseña nueva. Puede tardar unos minutos; revisá
              también el correo no deseado.
            </p>
            <Link href="/login" className="btn-primary w-full mt-7">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl text-center text-ink">
              Recuperar contraseña
            </h1>
            <p className="text-center text-ink-muted text-sm mt-1">
              Ingresá tu correo y te enviamos un enlace para restablecerla.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label className="label block mb-1.5">Correo electrónico</label>
                <input
                  className="input"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@campo.com"
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-error"
                >
                  {error}
                </motion.div>
              )}

              <button className="btn-primary w-full" disabled={loading}>
                {loading ? "Enviando…" : "Enviar enlace"}
              </button>
            </form>

            <div className="divider my-7" />
            <p className="text-center text-sm text-ink-muted">
              <Link href="/login" className="text-accent hover:underline">
                Volver a iniciar sesión
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </main>
  );
}
