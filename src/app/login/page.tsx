"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { login } from "@/lib/auth";
import { useApp } from "@/lib/context";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useApp();
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await login(identificador, password);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    refresh();
    router.push("/dashboard");
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
        <h1 className="font-display text-3xl text-center text-ink">Iniciar sesión</h1>
        <p className="text-center text-ink-muted text-sm mt-1">
          Entrá con tu correo o nombre de usuario.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label className="label block mb-1.5">Correo o usuario</label>
            <input
              className="input"
              autoFocus
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              placeholder="ej: juan@campo.com"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Contraseña</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </motion.div>
          )}

          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <div className="divider my-7" />
        <p className="text-center text-sm text-ink-muted">
          ¿Sos nuevo?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Crear cuenta
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
