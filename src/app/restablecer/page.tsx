"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PasswordChecklist, PasswordInput } from "@/components/PasswordInput";
import { cambiarPassword } from "@/lib/auth";
import { passwordValida } from "@/lib/password";
import { useApp } from "@/lib/context";
import { supabase, supabaseConfigurado } from "@/lib/supabase/client";

export default function RestablecerPage() {
  const router = useRouter();
  const { refresh } = useApp();
  const [estado, setEstado] = useState<"verificando" | "listo" | "invalido">(
    "verificando"
  );
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exito, setExito] = useState(false);

  // El link del correo trae un code que el cliente canjea por una sesión de recuperación
  // (detectSessionInUrl). Esperamos a que esa sesión exista para habilitar el formulario.
  useEffect(() => {
    if (!supabaseConfigurado()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEstado("invalido");
      return;
    }
    const sb = supabase();
    let vivo = true;
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      if (vivo && session) setEstado("listo");
    });
    (async () => {
      const { data } = await sb.auth.getSession();
      if (!vivo) return;
      if (data.session) {
        setEstado("listo");
      } else {
        setTimeout(() => {
          if (vivo) setEstado((s) => (s === "verificando" ? "invalido" : s));
        }, 4000);
      }
    })();
    return () => {
      vivo = false;
      subscription.unsubscribe();
    };
  }, []);

  const passOk = passwordValida(password);
  const coinciden = password === password2 && password2.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!passOk) {
      setError("La contraseña no cumple los requisitos de seguridad.");
      return;
    }
    if (!coinciden) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const r = await cambiarPassword(password);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setExito(true);
    refresh();
    setTimeout(() => router.replace("/dashboard"), 1600);
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

        {exito ? (
          <div className="text-center">
            <div className="flex justify-center mb-4 text-success">
              <ShieldCheck size={40} />
            </div>
            <h1 className="font-display text-2xl text-ink">¡Contraseña actualizada!</h1>
            <p className="text-ink-muted text-sm mt-2">Te estamos llevando a tu panel…</p>
          </div>
        ) : estado === "invalido" ? (
          <div className="text-center">
            <h1 className="font-display text-2xl text-ink">Enlace no válido</h1>
            <p className="text-ink-muted text-sm mt-2">
              El enlace expiró o ya se usó. Pedí uno nuevo para restablecer tu contraseña.
            </p>
            <Link href="/recuperar" className="btn-primary w-full mt-7">
              Pedir un enlace nuevo
            </Link>
          </div>
        ) : estado === "verificando" ? (
          <p className="text-center text-ink-dim py-8">Verificando el enlace…</p>
        ) : (
          <>
            <h1 className="font-display text-3xl text-center text-ink">Nueva contraseña</h1>
            <p className="text-center text-ink-muted text-sm mt-1">
              Elegí una contraseña segura para tu cuenta.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label className="label block mb-1.5">Nueva contraseña</label>
                <PasswordInput value={password} onChange={setPassword} autoFocus />
                <PasswordChecklist value={password} />
              </div>
              <div>
                <label className="label block mb-1.5">Repetir contraseña</label>
                <PasswordInput value={password2} onChange={setPassword2} />
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

              <button
                className="btn-primary w-full"
                disabled={loading || !passOk || !coinciden}
              >
                {loading ? "Guardando…" : "Guardar contraseña"}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </main>
  );
}
