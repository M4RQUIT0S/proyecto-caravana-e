"use client";

import { motion } from "framer-motion";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8"
    >
      <div>
        {eyebrow && <div className="label mb-2">{eyebrow}</div>}
        <h1 className="font-display text-3xl sm:text-4xl text-ink leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-ink-muted max-w-xl text-sm sm:text-base">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.div>
  );
}
