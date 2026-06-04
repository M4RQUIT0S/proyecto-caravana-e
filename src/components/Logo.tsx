"use client";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        className="text-accent"
      >
        <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M10 19c1.5-3 3-5 6-5s4.5 2 6 5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="16" cy="12" r="2.4" fill="currentColor" />
      </svg>
      <div className="leading-tight">
        <div className="font-display text-lg text-ink">AgroTrace</div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-ink-dim -mt-0.5">
          Trazabilidad
        </div>
      </div>
    </div>
  );
}
