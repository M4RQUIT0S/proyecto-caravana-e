"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { errorSync, reintentarSync } from "@/lib/supabase/sync";

// Aviso de cambios que el servidor RECHAZÓ (permisos, validación, sesión vencida). Sin
// esto el cambio queda sólo en este navegador y desaparece en la próxima recarga sin que
// nadie se entere. Se muestra hasta que el reintento salga bien.
// Trabajar sin señal NO pasa por acá: eso lo cubre el indicador de conectividad y se
// reintenta solo al volver la red (ver sync.ts).
export function SyncBanner() {
  const [error, setError] = useState<string | null>(null);
  const [reintentando, setReintentando] = useState(false);

  useEffect(() => {
    const leer = () => setError(errorSync());
    leer();
    window.addEventListener("caravanas:sync", leer);
    return () => window.removeEventListener("caravanas:sync", leer);
  }, []);

  const reintentar = useCallback(async () => {
    setReintentando(true);
    try {
      await reintentarSync();
    } finally {
      setReintentando(false);
    }
  }, []);

  if (!error) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-error backdrop-blur"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <strong>Hay cambios sin guardar en el servidor.</strong> Siguen visibles acá, pero
        se pierden si cerrás la sesión o recargás. Detalle: {error}
      </span>
      <button
        type="button"
        onClick={reintentar}
        disabled={reintentando}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 font-medium hover:bg-red-500/10 disabled:opacity-60"
      >
        {reintentando ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        )}
        {reintentando ? "Reintentando…" : "Reintentar"}
      </button>
    </div>
  );
}
