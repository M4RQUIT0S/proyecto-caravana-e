"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8"
    >
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/15">
            <Icon size={22} />
          </div>
        )}
        <div>
          {eyebrow && <div className="label mb-2">{eyebrow}</div>}
          <h1 className="font-display text-3xl sm:text-4xl text-ink leading-tight text-balance">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-ink-muted max-w-xl text-sm sm:text-base leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </motion.div>
  );
}
