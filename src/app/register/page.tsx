"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { OAuthButtons } from "@/components/OAuthButtons";
import { PasswordChecklist, PasswordInput } from "@/components/PasswordInput";
import { registrar } from "@/lib/auth";
import { passwordValida } from "@/lib/password";
import { useApp } from "@/lib/context";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useApp();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passOk = passwordValida(password);
  const coinciden = password === password2 && password2.length > 0;
  const puedeEnviar = passOk && coinciden && email.length > 0 && username.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passwordValida(password)) {
      setError("La contraseña no cumple los requisitos de seguridad.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const r = await registrar({ email, username, password });
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
        <h1 className="font-display text-3xl text-center text-ink">Crear cuenta</h1>
        <p className="text-center text-ink-muted text-sm mt-1">
          Tres datos y empezás a manejar tu campo.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label className="label block mb-1.5">Correo electrónico</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@campo.com"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Nombre de usuario</label>
            <input
              className="input"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="juanperez"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Contraseña</label>
            <PasswordInput value={password} onChange={setPassword} />
            <PasswordChecklist value={password} />
          </div>
          <div>
            <label className="label block mb-1.5">Repetir contraseña</label>
            <PasswordInput
              value={password2}
              onChange={setPassword2}
              autoComplete="new-password"
            />
            {password2.length > 0 && !coinciden && (
              <p className="mt-1.5 text-sm text-error">Las contraseñas no coinciden.</p>
            )}
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

          <button className="btn-primary w-full" disabled={loading || !puedeEnviar}>
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-ink-dim text-xs">
          <div className="h-px flex-1 bg-line" />
          <span>o registrate con</span>
          <div className="h-px flex-1 bg-line" />
        </div>
        <OAuthButtons />

        <div className="divider my-7" />
        <p className="text-center text-sm text-ink-muted">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </motion.div>
    </main>
  );
}
