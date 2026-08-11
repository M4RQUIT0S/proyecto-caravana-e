"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context";
import { Logo } from "@/components/Logo";
import {
  ArrowRight,
  Bluetooth,
  ShieldCheck,
  Users,
  Upload,
  Bell,
  Map,
} from "lucide-react";

const ANCHORS = [
  { href: "#funciones", label: "Funciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#trazabilidad", label: "Trazabilidad" },
];

export default function Landing() {
  const { user } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  return (
    <main>
      <Header />
      <Hero />
      <Metrics />
      <Features />
      <HowItWorks />
      <Traceability />
      <CtaSection />
      <Footer />
    </main>
  );
}

/* ---------------------------------- Header --------------------------------- */

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          {ANCHORS.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="text-sm text-ink-muted transition hover:text-ink"
            >
              {a.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm text-ink-muted transition hover:text-ink sm:inline"
          >
            Iniciar sesión
          </Link>
          <Link href="/register" className="btn-primary whitespace-nowrap">
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------------- Hero ---------------------------------- */

function Hero() {
  return (
    <section className="border-b border-line bg-bg-card">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-24">
        <div className="max-w-2xl">
          <div className="label">Trazabilidad ganadera individual</div>
          <h1 className="mt-4 font-display text-4xl leading-[1.1] text-ink text-balance sm:text-5xl">
            Cada animal identificado, cada evento registrado.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
            Registro por caravana RFID, lectura en manga sin conexión y la
            documentación de movimiento lista para presentar. Un solo sistema
            desde el nacimiento hasta la salida del campo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary">
              Crear cuenta <ArrowRight size={15} />
            </Link>
            <Link href="/login" className="btn-ghost">
              Iniciar sesión
            </Link>
          </div>
        </div>

        <div className="mt-14">
          <AppPreview />
        </div>
      </div>
    </section>
  );
}

/* Vista de la app hecha en markup, no una foto de stock: muestra el producto y
   además no envejece cuando la interfaz cambia. */
const FILAS = [
  { eid: "982 000412 883 011", lote: "Norte", cat: "Novillo", peso: "412", estado: "Activo" },
  { eid: "982 000412 883 012", lote: "Norte", cat: "Novillo", peso: "388", estado: "Activo" },
  { eid: "982 000412 883 047", lote: "Sur", cat: "Vaquillona", peso: "455", estado: "Activo" },
  { eid: "982 000412 883 048", lote: "Sur", cat: "Vaquillona", peso: "402", estado: "En tránsito" },
  { eid: "982 000412 883 103", lote: "Rincón", cat: "Ternero", peso: "196", estado: "Activo" },
];

function AppPreview() {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b border-line bg-bg-soft px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 truncate text-xs text-ink-dim">
          AgroTrace — Campo Los Álamos · Animales
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <div>
          <div className="font-heading text-sm text-ink">Animales</div>
          <div className="tnum text-xs text-ink-muted">1.284 registrados · 12 lotes</div>
        </div>
        <div className="hidden gap-2 sm:flex">
          <span className="chip">Sanidad al día</span>
          <span className="chip">3 carencias activas</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-[0.06em] text-ink-muted">
              <th className="px-4 py-2.5 font-medium">EID</th>
              <th className="px-4 py-2.5 font-medium">Lote</th>
              <th className="px-4 py-2.5 font-medium">Categoría</th>
              <th className="px-4 py-2.5 text-right font-medium">Peso</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map((f) => (
              <tr key={f.eid} className="border-b border-line last:border-0">
                <td className="tnum px-4 py-2.5 text-ink">{f.eid}</td>
                <td className="px-4 py-2.5 text-ink-muted">{f.lote}</td>
                <td className="px-4 py-2.5 text-ink-muted">{f.cat}</td>
                <td className="tnum px-4 py-2.5 text-right text-ink">{f.peso} kg</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-ink-muted">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        f.estado === "Activo" ? "bg-success" : "bg-warning"
                      }`}
                    />
                    {f.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------- Metrics --------------------------------- */

function Metrics() {
  const items = [
    { v: "RFID", l: "lectura por Bluetooth en la manga" },
    { v: "Offline", l: "el campo no siempre tiene señal" },
    { v: "DT-e", l: "documento de tránsito electrónico" },
    { v: "3 roles", l: "admin, usuario y sólo lectura" },
  ];
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 px-6 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.l} className="py-7">
            <div className="font-heading text-xl text-ink">{it.v}</div>
            <div className="mt-1 text-sm text-ink-muted">{it.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- Features --------------------------------- */

function Features() {
  const features = [
    {
      Icon: Bluetooth,
      title: "Lector RFID por Bluetooth",
      text: "Conectá el bastón y las caravanas entran solas. También se puede importar un .csv si preferís cargar por lote.",
    },
    {
      Icon: Map,
      title: "Campos y lotes",
      text: "Organizá la hacienda por campo, lote, categoría y raza. Los filtros y el buscador trabajan sobre el padrón completo.",
    },
    {
      Icon: Users,
      title: "Equipo con permisos",
      text: "Invitá por correo o con un código. Cada persona ve y edita sólo lo que su rol habilita en ese campo.",
    },
    {
      Icon: Bell,
      title: "Carencias y vencimientos",
      text: "Los tratamientos calculan su período de carencia y avisan antes de que un animal pueda moverse o venderse.",
    },
    {
      Icon: ShieldCheck,
      title: "Reglas de negocio",
      text: "Las validaciones corren al registrar, no al exportar: un evento inconsistente no llega a guardarse.",
    },
    {
      Icon: Upload,
      title: "Importación y exportación",
      text: "Entrada por planilla y salida en CSV o Excel para contabilidad, veterinaria o la presentación ante SENASA.",
    },
  ];

  return (
    <section id="funciones" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 className="max-w-xl font-heading text-2xl text-ink text-balance sm:text-3xl">
          Lo que necesita el registro diario de un campo
        </h2>
        <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ Icon, title, text }) => (
            <div key={title}>
              <Icon size={18} className="text-accent" strokeWidth={1.75} />
              <h3 className="mt-3 font-heading text-base text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- How it works ------------------------------ */

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Creá el campo",
      text: "Registrate, dá de alta el establecimiento y definí los lotes que ya usás.",
    },
    {
      n: "02",
      title: "Cargá el padrón",
      text: "Leé las caravanas con el bastón o importá la planilla que ya tenés armada.",
    },
    {
      n: "03",
      title: "Registrá en la manga",
      text: "Sanidad, pesaje y movimiento quedan asociados al animal, con o sin conexión.",
    },
  ];

  return (
    <section id="como-funciona" className="scroll-mt-16 border-b border-line bg-bg-card">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h2 className="font-heading text-2xl text-ink sm:text-3xl">Cómo se empieza</h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="border-t border-line pt-5">
              <div className="tnum font-heading text-sm text-accent">{s.n}</div>
              <h3 className="mt-2 font-heading text-lg text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Traceability ------------------------------ */

const HISTORIA = [
  { fecha: "12/03/2026", ev: "Alta", det: "Nacimiento · madre 982 000412 881 004" },
  { fecha: "04/06/2026", ev: "Sanidad", det: "Antiparasitario · carencia 21 días" },
  { fecha: "18/09/2026", ev: "Pesaje", det: "196 kg · lote Rincón" },
  { fecha: "02/12/2026", ev: "Movimiento", det: "Rincón → Norte" },
  { fecha: "15/01/2027", ev: "DT-e", det: "Documento emitido · destino frigorífico" },
];

function Traceability() {
  return (
    <section id="trazabilidad" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:items-start">
        <div>
          <div className="label">Historia por animal</div>
          <h2 className="mt-3 font-heading text-2xl text-ink text-balance sm:text-3xl">
            La trazabilidad no es un reporte: es el registro de cada evento, en
            orden.
          </h2>
          <p className="mt-4 leading-relaxed text-ink-muted">
            Cada caravana acumula su propia historia. Cuando SENASA, el
            comprador o el veterinario piden el recorrido de un animal, ya está
            armado — no hay que reconstruirlo desde planillas sueltas.
          </p>
        </div>

        <div className="rounded-md border border-line bg-bg-card">
          <div className="border-b border-line px-4 py-3">
            <div className="tnum font-heading text-sm text-ink">982 000412 883 103</div>
            <div className="text-xs text-ink-muted">Ternero · lote Norte</div>
          </div>
          <ul>
            {HISTORIA.map((h) => (
              <li
                key={h.fecha}
                className="flex gap-4 border-b border-line px-4 py-3 last:border-0"
              >
                <span className="tnum w-[76px] shrink-0 text-xs leading-5 text-ink-dim">
                  {h.fecha}
                </span>
                <span className="w-[88px] shrink-0 text-sm text-ink">{h.ev}</span>
                <span className="text-sm text-ink-muted">{h.det}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- CTA band --------------------------------- */

function CtaSection() {
  return (
    <section className="border-b border-line bg-bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl text-ink sm:text-2xl">
            Empezá con un campo y el padrón que ya tenés
          </h2>
          <p className="mt-1.5 text-ink-muted">
            La cuenta es gratuita y la carga inicial se hace por planilla.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <Link href="/register" className="btn-primary">
            Crear cuenta <ArrowRight size={15} />
          </Link>
          <Link href="/login" className="btn-ghost">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Footer ---------------------------------- */

function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-9 sm:flex-row sm:items-center">
        <Logo />
        <p className="text-sm text-ink-dim">
          {`© ${new Date().getFullYear()} AgroTrace · Trazabilidad ganadera`}
        </p>
      </div>
    </footer>
  );
}
