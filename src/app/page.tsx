"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context";
import { Logo } from "@/components/Logo";
import { ArrowRight, Bluetooth, ShieldCheck, Users } from "lucide-react";

export default function Landing() {
  const { user } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  return (
    <main className="min-h-screen px-6">
      <div className="mx-auto max-w-6xl pt-8">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex gap-2">
            <Link href="/login" className="btn-ghost text-sm">
              Iniciar sesión
            </Link>
            <Link href="/register" className="btn-primary text-sm">
              Crear cuenta
            </Link>
          </div>
        </div>

        <section className="grid lg:grid-cols-2 gap-12 items-center pt-16 sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="label mb-3">Gestión ganadera digital</div>
            <h1 className="font-display text-5xl sm:text-6xl leading-[1.05] text-ink">
              Tus campos, tus lotes,{" "}
              <span className="shimmer-text">cada caravana</span> bajo control.
            </h1>
            <p className="mt-5 text-ink-muted text-lg max-w-xl">
              Centralizá la información de tus animales con caravanas RFID.
              Importá desde el lector vía Bluetooth, desde un archivo o desde Drive,
              y compartí cada campo con tu equipo con roles bien definidos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary">
                Empezar ahora <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="btn-ghost">
                Ya tengo cuenta
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="card p-6 sm:p-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Feature
                Icon={Users}
                title="Roles claros"
                text="Admin, usuario y sólo vista por campo. Invitá por correo o con código."
              />
              <Feature
                Icon={Bluetooth}
                title="Lector RFID"
                text="Conectá tu lector por Bluetooth y recibí las caravanas como CSV."
              />
              <Feature
                Icon={ShieldCheck}
                title="Lotes y alertas"
                text="Organizá por categoría y raza, y agendá alertas por animal."
              />
              <Feature
                Icon={ArrowRight}
                title="Importación flexible"
                text="Cargá .csv desde tu equipo, desde Drive o desde el lector."
              />
            </div>
          </motion.div>
        </section>

        <div className="py-24 text-center text-ink-dim text-sm">
          Diseñado para correr en escritorio y celulares. Listo para deploy en Vercel.
        </div>
      </div>
    </main>
  );
}

function Feature({
  Icon,
  title,
  text,
}: {
  Icon: any;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft/60 p-4">
      <div className="flex items-center gap-2 text-accent">
        <Icon size={16} />
        <div className="text-sm font-medium text-ink">{title}</div>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{text}</p>
    </div>
  );
}
