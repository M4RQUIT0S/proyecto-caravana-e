"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut, MapPin, Mail, User } from "lucide-react";
import { Logo } from "./Logo";
import { useApp } from "@/lib/context";
import { logout } from "@/lib/auth";

const links = [
  { href: "/dashboard", label: "Mis campos", icon: MapPin },
  { href: "/invitaciones", label: "Invitaciones", icon: Mail },
];

export function Navbar() {
  const { user, refresh } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function salir() {
    logout();
    refresh();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center">
          <Logo />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const Icon = l.icon;
            const active = pathname?.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative px-3 py-2 text-sm rounded-lg transition ${
                  active ? "text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon size={15} />
                  {l.label}
                </span>
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-lg bg-bg-soft border border-line"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2 rounded-full border border-line bg-bg-soft pl-3 pr-1 py-1">
              <User size={14} className="text-accent" />
              <span className="text-sm text-ink-muted">{user.username}</span>
              <button
                onClick={salir}
                className="ml-1 rounded-full p-1.5 text-ink-dim hover:text-ink hover:bg-bg transition"
                title="Cerrar sesión"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          className="md:hidden rounded-lg border border-line p-2 text-ink"
          aria-label="Menú"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="md:hidden overflow-hidden border-t border-line bg-bg/95 backdrop-blur-xl"
          >
            <div className="px-4 py-3 space-y-1">
              {links.map((l) => {
                const Icon = l.icon;
                const active = pathname?.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      active
                        ? "bg-bg-soft text-ink border border-line"
                        : "text-ink-muted hover:text-ink hover:bg-bg-soft"
                    }`}
                  >
                    <Icon size={16} />
                    {l.label}
                  </Link>
                );
              })}
              {user && (
                <button
                  onClick={() => {
                    setOpen(false);
                    salir();
                  }}
                  className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-muted hover:text-error hover:bg-red-500/5"
                >
                  <LogOut size={16} />
                  Cerrar sesión ({user.username})
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
