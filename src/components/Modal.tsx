"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const w = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            // max-h + flex-col: la cabecera queda fija y el cuerpo scrollea cuando el
            // contenido es más alto que la pantalla (antes no se podía llegar abajo).
            className={`relative w-full ${w} card p-6 my-auto flex max-h-[calc(100dvh-2rem)] flex-col`}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-ink-dim hover:text-ink hover:bg-bg-soft"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
            {title && (
              <h3 className="font-display text-2xl mb-4 pr-8 text-ink shrink-0">{title}</h3>
            )}
            <div className="overflow-y-auto -mr-2 pr-2">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
