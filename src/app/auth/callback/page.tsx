"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { useApp } from "@/lib/context";

// Página de retorno del login con Google/Apple. El cliente de Supabase canjea el code de
// la URL por una sesión (detectSessionInUrl) y el contexto hidrata al usuario; en cuanto
// `user` existe, redirigimos al panel. Si tarda demasiado, ofrecemos volver al login.
export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, loading } = useApp();
  const [tardanza, setTardanza] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    const t = setTimeout(() => setTardanza(true), 8000);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-9 text-center">
        <div className="flex items-center justify-center mb-6">
          <Logo />
        </div>
        {tardanza && !loading && !user ? (
          <>
            <h1 className="font-display text-2xl text-ink">No pudimos completar el ingreso</h1>
            <p className="text-ink-muted text-sm mt-2">
              Hubo un problema al conectar tu cuenta. Probá de nuevo.
            </p>
            <Link href="/login" className="btn-primary w-full mt-7">
              Volver a iniciar sesión
            </Link>
          </>
        ) : (
          <p className="text-ink-dim py-6">Conectando tu cuenta…</p>
        )}
      </div>
    </main>
  );
}
