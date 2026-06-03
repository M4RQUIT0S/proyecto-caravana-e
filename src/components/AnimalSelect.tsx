"use client";

import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { esActivo, estado } from "@/lib/reglas";
import type { Animal } from "@/lib/types";

// Selector de animal por CII/caravana, nombre o categoría. Para flujos de captura
// (sanidad, pesaje, movimiento) donde el animal nace de la lectura RFID o de una búsqueda.
export function AnimalSelect({
  animales,
  value,
  onChange,
  placeholder = "Buscar por caravana, nombre o categoría…",
}: {
  animales: Animal[];
  value?: string;
  onChange: (animalId: string | undefined) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const seleccionado = animales.find((a) => a.id === value);

  const resultados = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = animales.filter((a) => esActivo(a) && estado(a) !== "muerto" && estado(a) !== "egresado");
    if (term) {
      list = list.filter(
        (a) =>
          a.caravana.toLowerCase().includes(term) ||
          a.nombre?.toLowerCase().includes(term) ||
          a.categoria?.toLowerCase().includes(term)
      );
    }
    return list.slice(0, 30);
  }, [animales, q]);

  if (seleccionado) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/5 px-3 py-2.5">
        <div>
          <div className="font-mono text-accent">{seleccionado.caravana}</div>
          <div className="text-xs text-ink-muted">
            {seleccionado.categoria || "—"} · estado: {estado(seleccionado)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(undefined);
            setQ("");
          }}
          className="btn-ghost text-xs"
        >
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-bg-soft px-3 py-2">
        <Search size={15} className="text-ink-dim" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-sm placeholder:text-ink-dim"
        />
      </div>
      {q.trim() && (
        <div className="mt-1 max-h-52 overflow-auto rounded-xl border border-line bg-bg-soft">
          {resultados.length === 0 ? (
            <div className="px-3 py-2 text-sm text-ink-dim">Sin coincidencias.</div>
          ) : (
            resultados.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => {
                  onChange(a.id);
                  setQ("");
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-bg/60 border-b border-line/50 last:border-0"
              >
                <span>
                  <span className="font-mono text-accent">{a.caravana}</span>{" "}
                  <span className="text-ink-muted">{a.categoria || ""}</span>
                </span>
                <Check size={14} className="text-ink-dim" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
