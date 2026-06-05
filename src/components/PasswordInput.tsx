"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Circle, Eye, EyeOff } from "lucide-react";
import { requisitosPassword } from "@/lib/password";

export function PasswordInput({
  value,
  onChange,
  placeholder = "••••••••",
  autoFocus,
  autoComplete = "new-password",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        className="input pr-10"
        type={visible ? "text" : "password"}
        value={value}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-dim hover:text-ink transition-colors p-1"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

// Lista de requisitos que se van tildando en verde a medida que se escribe.
export function PasswordChecklist({ value }: { value: string }) {
  const reqs = requisitosPassword(value);
  return (
    <ul className="mt-2 space-y-1">
      {reqs.map((r) => (
        <li key={r.id} className="flex items-center gap-2 text-sm">
          <AnimatePresence mode="wait" initial={false}>
            {r.ok ? (
              <motion.span
                key="ok"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="text-success"
              >
                <Check size={16} strokeWidth={3} />
              </motion.span>
            ) : (
              <motion.span
                key="pending"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-ink-dim"
              >
                <Circle size={14} />
              </motion.span>
            )}
          </AnimatePresence>
          <span className={r.ok ? "text-success" : "text-ink-muted"}>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}
