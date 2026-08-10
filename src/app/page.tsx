"use client";

import Link from "next/link";
import Image from "next/image";
import { MotionConfig, motion } from "framer-motion";
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

/* Lenguaje visual "soft UI": superficies extruidas (sombra difusa + filo de luz
   arriba), esquinas muy redondeadas, píldoras y una paleta apagada de salvia,
   azul grisado y lavanda. Las clases viven acá y no en globals.css a propósito:
   `.card` y `.btn-*` son globales y las usa toda la app. */
const SURFACE = "rounded-[28px] bg-bg-card shadow-lift";
const PILL =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition " +
  "active:translate-y-px active:shadow-press " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lavender/70";
const BTN_PRIMARY = `${PILL} bg-sage-deep px-6 py-3 text-bg-card shadow-lift hover:bg-accent-deep`;
const BTN_QUIET = `${PILL} border border-line bg-bg-card px-6 py-3 text-ink shadow-sm hover:bg-bg-soft`;
const ANCHORS = [
  { href: "#funciones", label: "Funciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#beneficios", label: "Beneficios" },
];

export default function Landing() {
  const { user } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  return (
    // reducedMotion="user" desactiva todas las animaciones de abajo si el sistema
    // lo pide; evita repetir la condición en cada `motion.*`.
    <MotionConfig reducedMotion="user">
      <main className="min-h-screen bg-mist bg-[radial-gradient(900px_500px_at_85%_-5%,#F3F2EE_0%,transparent_60%),radial-gradient(700px_420px_at_-5%_105%,#DDE6DB_0%,transparent_55%)]">
        <Header />
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <Showcase />
        <CtaSection />
        <Footer />
      </main>
    </MotionConfig>
  );
}

/* ---------------------------------- Header --------------------------------- */

function Header() {
  return (
    <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-white/60 bg-bg-card/80 py-2.5 pl-5 pr-2.5 shadow-lift backdrop-blur-md">
        <Logo />

        {/* Grupo hundido: la nav se lee como una pieza, no como links sueltos. */}
        <nav className="hidden items-center gap-1 rounded-full bg-mist/70 p-1 shadow-press md:flex">
          {ANCHORS.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className={`${PILL} px-4 py-2 text-sm text-ink-muted hover:bg-bg-card hover:text-ink hover:shadow-sm`}
            >
              {a.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/login"
            className={`${PILL} hidden px-4 py-2.5 text-sm text-ink-muted hover:bg-bg-soft hover:text-ink sm:inline-flex`}
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className={`${PILL} whitespace-nowrap bg-sage-deep px-5 py-2.5 text-sm text-bg-card shadow-lift hover:bg-accent-deep`}
          >
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
    <section className="px-6 pt-16 sm:pt-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-lavender-pale px-4 py-1.5 text-xs font-medium text-lavender-deep shadow-press">
            <span className="h-1.5 w-1.5 rounded-full bg-lavender-deep" />
            Gestión ganadera digital, simple de usar
          </div>
          <h1 className="font-display text-4xl leading-[1.2] text-ink text-balance sm:text-6xl">
            Toda tu hacienda{" "}
            {/* nowrap: el resaltado partido en dos lineas se lee como dos cajas sueltas. */}
            <span className="whitespace-nowrap rounded-2xl bg-sage-soft px-2.5 text-accent-deep shadow-press">
              bajo control
            </span>
            , desde el campo hasta el celular.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-muted text-pretty">
            Registrá tus animales con caravanas RFID, organizá tus campos y lotes,
            y compartí todo con tu equipo. Sin planillas, sin complicaciones.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/register" className={BTN_PRIMARY}>
              Empezar gratis <ArrowRight size={16} />
            </Link>
            <Link href="/login" className={BTN_QUIET}>
              Ya tengo cuenta
            </Link>
          </div>

          {/* En móvil la nav del header está oculta: sin esto las secciones
              ancladas quedan inalcanzables salvo scrolleando a ciegas. */}
          <div className="mt-8 flex flex-wrap justify-center gap-2 md:hidden">
            {ANCHORS.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className={`${PILL} bg-bg-card px-4 py-2 text-sm text-ink-muted shadow-sm`}
              >
                {a.label}
              </a>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-16 rounded-[36px] bg-bg-card p-2.5 shadow-lift-lg"
        >
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[28px] sm:aspect-[21/9]">
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
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 rounded-[32px] bg-bg-card/70 p-4 shadow-press sm:gap-6 sm:p-6 lg:grid-cols-4">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-3xl bg-bg-card px-4 py-6 text-center shadow-lift"
          >
            <div className="font-display text-2xl text-accent-deep sm:text-3xl">
              {it.value}
            </div>
            <div className="mt-1 text-sm text-ink-muted">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- Features --------------------------------- */

/* Tintes del mockup. Van como superficie con texto `ink` encima: los tonos
   medios con texto blanco daban ~2:1 y no pasaban AA.
   El cuerpo va en `ink/80` y no en `ink-muted`: ink-muted (#486848) sobre
   sage-soft da 4.03:1 y sobre steel-soft 3.95:1, por debajo del 4.5:1 que
   pide AA a este tamaño. ink/80 compuesto sobre el tinte más oscuro da
   4.66:1 y conserva la jerarquía contra el título. */
const TINTS = [
  "bg-sage-soft",
  "bg-steel-pale",
  "bg-lavender-soft",
  "bg-steel-soft",
  "bg-sage-pale",
  "bg-lavender-pale",
];

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
    <section id="funciones" className="scroll-mt-28 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <div className="label mb-3">Todo lo que necesitás</div>
          <h2 className="font-heading text-3xl text-ink text-balance sm:text-4xl">
            Pensado para que cualquiera lo use, no sólo los expertos.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ Icon, title, text }, i) => (
            <div
              key={title}
              className={`${TINTS[i]} rounded-[28px] p-6 shadow-lift transition hover:-translate-y-1 hover:shadow-lift-lg`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg-card/80 text-accent-deep shadow-sm">
                <Icon size={20} />
              </div>
              <h3 className="mt-4 font-heading text-lg text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/80">{text}</p>
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
    <section id="como-funciona" className="scroll-mt-28 px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <div className="label mb-3">Cómo funciona</div>
          <h2 className="font-heading text-3xl text-ink text-balance sm:text-4xl">
            Empezá en tres pasos sencillos
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className={`${SURFACE} p-7`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-deep text-lg font-bold text-bg-card shadow-lift">
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
    <section id="beneficios" className="scroll-mt-28 px-6 py-8">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
        <div className="rounded-[32px] bg-bg-card p-2.5 shadow-lift-lg">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[24px]">
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
          <ul className="mt-7 space-y-3">
            {points.map((p) => (
              <li
                key={p}
                className="flex items-center gap-3 rounded-2xl bg-bg-card px-4 py-3 shadow-sm"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lavender-soft text-lavender-deep">
                  <Check size={14} />
                </span>
                <span className="text-ink">{p}</span>
              </li>
            ))}
          </ul>
          <Link href="/register" className={`${BTN_PRIMARY} mt-8`}>
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
        <div className="flex flex-col items-center gap-6 rounded-[36px] bg-sage-pale px-6 py-16 text-center shadow-lift-lg sm:px-12">
          <h2 className="font-display text-3xl text-accent-deep text-balance sm:text-4xl">
            Llevá tu campo al siguiente nivel
          </h2>
          <p className="max-w-xl leading-relaxed text-accent-soft">
            Sumate a los productores que ya digitalizaron su hacienda. Creá tu
            cuenta gratis y cargá tu primer campo hoy mismo.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/register" className={BTN_PRIMARY}>
              Crear cuenta gratis <ArrowRight size={16} />
            </Link>
            <Link href="/login" className={BTN_QUIET}>
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
    <footer className="px-6 pb-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 rounded-[28px] bg-bg-card px-6 py-7 shadow-lift sm:flex-row">
        <Logo />
        <p className="text-sm text-ink-dim">
          {`© ${new Date().getFullYear()} AgroTrace · Trazabilidad ganadera`}
        </p>
      </div>
    </footer>
  );
}
