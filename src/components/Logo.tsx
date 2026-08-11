"use client";

import Image from "next/image";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image
        src="/vaca.png"
        alt="AgroTrace"
        width={size}
        height={size}
        priority
      />
      <div className="leading-tight">
        <div className="font-heading text-base text-ink">AgroTrace</div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-ink-dim -mt-0.5">
          Trazabilidad
        </div>
      </div>
    </div>
  );
}
