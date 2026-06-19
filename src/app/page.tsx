"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
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
  Check,
} from "lucide-react";

export default function Landing() {
  const { user } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <Showcase />
      <CtaSection />
      <Footer />
    </main>
  );
}

/* ---------------------------------- Header --------------------------------- */

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#funciones" className="text-sm text-ink-muted transition hover:text-ink">
            Funciones
          </a>
          <a href="#como-funciona" className="text-sm text-ink-muted transition hover:text-ink">
            Cómo funciona
          </a>
          <a href="#beneficios" className="text-sm text-ink-muted transition hover:text-ink">
            Beneficios
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost text-sm">
            Iniciar sesión
          </Link>
          <Link href="/register" className="btn-primary text-sm">
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
    <section className="px-6 pt-14 sm:pt-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-bg-card px-3 py-1 text-xs font-medium text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-action" />
            Gestión ganadera digital, simple de usar
          </div>
          <h1 className="font-display text-4xl leading-[1.05] text-ink text-balance sm:text-6xl">
            Toda tu hacienda{" "}
            <span className="shimmer-text">bajo control</span>, desde el campo
            hasta el celular.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-muted text-pretty">
            Registrá tus animales con caravanas RFID, organizá tus campos y lotes,
            y compartí todo con tu equipo. Sin planillas, sin complicaciones.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn-primary">
              Empezar gratis <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="btn-ghost">
              Ya tengo cuenta
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="card mt-14 overflow-hidden p-0"
        >
          <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
            <Image
              src="/hero-ganaderia.png"
              alt="Ganado pastando en un campo verde al atardecer"
              fill
              priority
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="object-cover"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------------------- Stats ---------------------------------- */

function Stats() {
  const items = [
    { value: "1 toque", label: "para leer una caravana" },
    { value: "100%", label: "tus datos, tu campo" },
    { value: "3 roles", label: "admin, usuario y sólo vista" },
    { value: "0 planillas", label: "todo en un solo lugar" },
  ];
  return (
    <section className="px-6 py-16 sm:py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <div className="font-display text-3xl text-ink sm:text-4xl">{it.value}</div>
            <div className="mt-1 text-sm text-ink-muted">{it.label}</div>
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
      text: "Conectá tu lector y las caravanas llegan solas. También podés cargar un archivo .csv o importar desde Drive.",
    },
    {
      Icon: Map,
      title: "Campos y lotes ordenados",
      text: "Organizá tus animales por campo, categoría y raza. Encontrá cualquier dato en segundos.",
    },
    {
      Icon: Users,
      title: "Trabajo en equipo",
      text: "Invitá a tu equipo por correo o con un código. Cada persona ve sólo lo que le corresponde.",
    },
    {
      Icon: Bell,
      title: "Alertas por animal",
      text: "Agendá recordatorios de sanidad y movimientos para que no se te escape nada.",
    },
    {
      Icon: ShieldCheck,
      title: "Roles y permisos claros",
      text: "Admin, usuario y sólo vista por campo. Vos decidís quién puede editar.",
    },
    {
      Icon: Upload,
      title: "Importación flexible",
      text: "Sumá tu información de la forma que más te convenga, sin perder tiempo cargando a mano.",
    },
  ];

  return (
    <section id="funciones" className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <div className="label mb-3">Todo lo que necesitás</div>
          <h2 className="font-heading text-3xl text-ink text-balance sm:text-4xl">
            Pensado para que cualquiera lo use, no sólo los expertos.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ Icon, title, text }) => (
            <div key={title} className="card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Icon size={20} />
              </div>
              <h3 className="mt-4 font-heading text-lg text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{text}</p>
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
      n: "1",
      title: "Creá tu campo",
      text: "Registrate y armá tu primer campo en menos de un minuto.",
    },
    {
      n: "2",
      title: "Cargá tus animales",
      text: "Leé las caravanas con el lector o importá un archivo. Listo.",
    },
    {
      n: "3",
      title: "Gestioná y compartí",
      text: "Organizá lotes, agendá alertas e invitá a tu equipo.",
    },
  ];

  return (
    <section id="como-funciona" className="px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="label mb-3">Cómo funciona</div>
          <h2 className="font-heading text-3xl text-ink text-balance sm:text-4xl">
            Empezá en tres pasos sencillos
          </h2>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action text-lg font-bold text-bg-card">
                {s.n}
              </div>
              <h3 className="mt-5 font-heading text-xl text-ink">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-muted">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- Showcase --------------------------------- */

function Showcase() {
  const points = [
    "Funciona en la computadora y en el celular",
    "Tus datos siempre disponibles y respaldados",
    "Trazabilidad completa de cada animal",
  ];
  return (
    <section id="beneficios" className="px-6 py-8">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
        <div className="card overflow-hidden p-0">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src="/detalle-caravana.png"
              alt="Caravana RFID en la oreja de un animal"
              fill
              sizes="(max-width: 1024px) 100vw, 576px"
              className="object-cover"
            />
          </div>
        </div>
        <div>
          <div className="label mb-3">Trazabilidad de verdad</div>
          <h2 className="font-heading text-3xl text-ink text-balance sm:text-4xl">
            Cada caravana cuenta una historia. Nosotros la guardamos por vos.
          </h2>
          <p className="mt-4 leading-relaxed text-ink-muted">
            Seguí el recorrido de cada animal: dónde está, a qué lote pertenece y
            qué eventos de sanidad tuvo. Información clara, siempre a mano.
          </p>
          <ul className="mt-6 space-y-3">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Check size={14} />
                </span>
                <span className="text-ink">{p}</span>
              </li>
            ))}
          </ul>
          <Link href="/register" className="btn-primary mt-8">
            Probar ahora <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- CTA band --------------------------------- */

function CtaSection() {
  return (
    <section className="px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="card flex flex-col items-center gap-6 px-6 py-14 text-center sm:px-12">
          <h2 className="font-display text-3xl text-ink text-balance sm:text-4xl">
            Llevá tu campo al siguiente nivel
          </h2>
          <p className="max-w-xl leading-relaxed text-ink-muted">
            Sumate a los productores que ya digitalizaron su hacienda. Creá tu
            cuenta gratis y cargá tu primer campo hoy mismo.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register" className="btn-primary">
              Crear cuenta gratis <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="btn-ghost">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Footer ---------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-line/70 px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <Logo />
        <p className="text-sm text-ink-dim">
          {`© ${new Date().getFullYear()} AgroTrace · Trazabilidad ganadera`}
        </p>
      </div>
    </footer>
  );
}
