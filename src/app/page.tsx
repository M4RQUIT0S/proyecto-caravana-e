"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context";
import { Logo } from "@/components/Logo";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ScanLine, Tag, Truck } from "lucide-react";

// La escena 3D es client-only (WebGL): se carga dinámicamente sin SSR.
const Escena = dynamic(() => import("@/components/landing/Escena").then((m) => m.Escena), {
  ssr: false,
  loading: () => <Cargando />,
});

const PASOS = [
  {
    label: "El campo",
    Icon: Tag,
    titulo: "Cada animal, su caravana",
    desc: "Identificá tu hacienda con caravanas RFID y construí la trazabilidad individual de cada animal desde el nacimiento.",
  },
  {
    label: "La manga",
    Icon: ScanLine,
    titulo: "Captura en la manga",
    desc: "Leé el bastón por Bluetooth y registrá sanidad, pesaje y movimientos en el momento — incluso sin conexión.",
  },
  {
    label: "Transporte",
    Icon: Truck,
    titulo: "Movimientos y SENASA",
    desc: "Controlá carencias, generá el DT-e y preparás la sincronización con SENASA antes de mover la tropa.",
  },
];

function Cargando() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg">
      <Logo />
      <p className="text-ink-dim text-sm animate-pulse">Cargando experiencia…</p>
    </div>
  );
}

export default function Landing() {
  const { user } = useApp();
  const router = useRouter();
  const [activo, setActivo] = useState(0);
  const [interactuado, setInteractuado] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  const ir = useCallback((i: number) => {
    setInteractuado(true);
    setActivo(((i % PASOS.length) + PASOS.length) % PASOS.length);
  }, []);

  // Navegación por teclado (flechas).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") ir(activo + 1);
      else if (e.key === "ArrowLeft") ir(activo - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activo, ir]);

  // Recorrido automático hasta que el usuario interactúa.
  useEffect(() => {
    if (interactuado) return;
    const t = setInterval(() => setActivo((a) => (a + 1) % PASOS.length), 5200);
    return () => clearInterval(t);
  }, [interactuado]);

  const paso = PASOS[activo];

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg">
      {/* Escena 3D de fondo */}
      <div className="absolute inset-0">
        <Escena activo={activo} />
      </div>

      {/* Degradados de legibilidad (no tapan la escena del lado derecho) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent sm:via-bg/55 sm:to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-bg/90 to-transparent" />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <Logo />
        <div className="flex gap-2">
          <Link href="/login" className="btn-ghost text-sm">
            Iniciar sesión
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            Crear cuenta
          </Link>
        </div>
      </header>

      {/* Hero copy */}
      <div className="pointer-events-none relative z-10 mx-auto max-w-6xl px-6 pt-10 sm:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-xl"
        >
          <div className="label mb-3">Trazabilidad ganadera digital</div>
          <h1 className="font-display text-4xl sm:text-5xl leading-[1.07] text-ink">
            Tu campo, tu tropa,{" "}
            <span className="shimmer-text">cada caravana</span> de punta a punta.
          </h1>
          <p className="mt-4 text-ink-muted text-lg">
            Seguí el recorrido: del campo a la manga, y de la manga al camión con su DT-e.
          </p>
        </motion.div>
      </div>

      {/* Tarjeta del paso activo + navegación */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto max-w-6xl px-6 pb-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={activo}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="card max-w-md p-5"
            >
              <div className="flex items-center gap-2 text-accent">
                <paso.Icon size={16} />
                <span className="label">
                  Paso {activo + 1} de {PASOS.length} · {paso.label}
                </span>
              </div>
              <h2 className="font-display text-2xl text-ink mt-2">{paso.titulo}</h2>
              <p className="text-ink-muted text-sm mt-1.5">{paso.desc}</p>
              <Link href="/register" className="btn-primary text-sm mt-4 w-fit">
                Empezar ahora <ArrowRight size={15} />
              </Link>
            </motion.div>
          </AnimatePresence>

          {/* Controles de waypoint */}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => ir(activo - 1)}
              aria-label="Anterior"
              className="grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-bg-card text-ink hover:bg-bg-soft transition"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-2">
              {PASOS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => ir(i)}
                  aria-label={p.label}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                    i === activo
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-line bg-bg-card/70 text-ink-muted hover:text-ink"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      i === activo ? "bg-action" : "bg-line-strong"
                    }`}
                  />
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => ir(activo + 1)}
              aria-label="Siguiente"
              className="grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-bg-card text-ink hover:bg-bg-soft transition"
            >
              <ChevronRight size={18} />
            </button>

            <span className="ml-2 hidden items-center gap-1 text-xs text-ink-dim md:flex">
              <ArrowLeft size={13} /> <ArrowRight size={13} /> usá las flechas
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
