"use client";

import { useState } from "react";
import { iniciarOAuth } from "@/lib/auth";

// Logos de marca (inline SVG) para no depender de assets externos.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 384 512" aria-hidden fill="currentColor">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C61.4 141.5 9.4 178.3 9.4 250.6c0 21.4 3.9 43.5 11.8 66.3 10.5 30.3 48.3 104.7 87.7 103.5 20.6-.5 35.2-14.6 62-14.6 26 0 39.5 14.6 62.4 14.6 39.8-.6 74-68.2 84-98.6-53.4-25.2-50.6-73.8-50.6-75.1zm-56.6-144.5c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

export function OAuthButtons() {
  const [loading, setLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function entrar(provider: "google" | "apple") {
    setError(null);
    setLoading(provider);
    const r = await iniciarOAuth(provider);
    if (!r.ok) {
      setError(r.error);
      setLoading(null);
    }
    // En caso de éxito el navegador redirige al proveedor; no reseteamos el loading.
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => entrar("google")}
        disabled={loading !== null}
        className="btn-ghost w-full justify-center gap-2.5"
      >
        <GoogleIcon />
        {loading === "google" ? "Conectando…" : "Continuar con Google"}
      </button>
      <button
        type="button"
        onClick={() => entrar("apple")}
        disabled={loading !== null}
        className="btn-ghost w-full justify-center gap-2.5"
      >
        <AppleIcon />
        {loading === "apple" ? "Conectando…" : "Continuar con Apple"}
      </button>
      {error && (
        <p className="text-sm text-error text-center">{error}</p>
      )}
    </div>
  );
}
