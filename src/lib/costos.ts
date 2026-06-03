"use client";

// Imputación de costos por animal o lote (insumo de los reportes de rentabilidad, RU07).
// El sistema produce información de costos productivos, no contabilidad general (exclusión E-02).

import { uid, update } from "./storage";
import type { CostoAnimal, TipoCosto } from "./types";

export interface InputCosto {
  campoId: string;
  animalId?: string;
  loteId?: string;
  tipoCosto: TipoCosto;
  monto: number;
  moneda?: string;
  fecha?: string;
  descripcion?: string;
  proveedorId?: string;
}

export function imputarCosto(input: InputCosto): void {
  update((db) => {
    db.costos.push({
      id: uid("cost_"),
      campoId: input.campoId,
      animalId: input.animalId,
      loteId: input.loteId,
      tipoCosto: input.tipoCosto,
      monto: input.monto,
      moneda: input.moneda ?? "ARS",
      fecha: input.fecha,
      descripcion: input.descripcion,
      proveedorId: input.proveedorId,
      createdAt: Date.now(),
    });
  });
}

export function eliminarCosto(id: string): void {
  update((db) => {
    db.costos = db.costos.filter((c) => c.id !== id);
  });
}

export function costosDe(campoId: string, costos: CostoAnimal[]): CostoAnimal[] {
  return costos.filter((c) => c.campoId === campoId).sort((a, b) => b.createdAt - a.createdAt);
}

// Costo total imputado a un animal: directo + prorrateo de los costos de su lote.
export function costoDeAnimal(
  animalId: string,
  loteId: string | undefined,
  costos: CostoAnimal[],
  animalesPorLote: Map<string, number>
): number {
  let total = 0;
  for (const c of costos) {
    if (c.animalId === animalId) total += c.monto;
    else if (loteId && c.loteId === loteId && !c.animalId) {
      const n = animalesPorLote.get(loteId) || 1;
      total += c.monto / n;
    }
  }
  return Math.round(total * 100) / 100;
}

export const LABEL_COSTO: Record<TipoCosto, string> = {
  alimentacion: "Alimentación",
  sanidad: "Sanidad",
  mano_obra: "Mano de obra",
  reposicion: "Reposición",
  otro: "Otro",
};
