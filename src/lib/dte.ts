"use client";

// CU-07: preparación de documentación regulatoria (DT-e). Bloqueo duro por carencia
// (RF-13 / RN03) con detalle por animal, y validación de datos obligatorios (RN06).

import { uid, update } from "./storage";
import { aptoParaFaena, datosDTeObligatorios } from "./reglas";
import type { Animal, DocumentoTransito } from "./types";

export interface AnimalBloqueado {
  animalId: string;
  caravana: string;
  motivo: string;
}

export interface InputDTe {
  campoId: string;
  animalIds: string[];
  origen: string;
  destino: string;
  numeroDTe?: string;
}

export type ResultadoDTe =
  | { ok: true; documentoId: string }
  | { ok: false; error: string; bloqueados: AnimalBloqueado[] };

// Valida y deja el paquete del DT-e listo para sincronizar (estado "preparado").
export function prepararDTe(input: InputDTe, animales: Animal[]): ResultadoDTe {
  const seleccion = animales.filter((a) => input.animalIds.includes(a.id));
  if (seleccion.length === 0)
    return { ok: false, error: "Seleccioná al menos un animal.", bloqueados: [] };

  // Bloqueo duro por carencia / estado (RF-13 / RN03), con detalle por animal.
  const bloqueados: AnimalBloqueado[] = [];
  for (const a of seleccion) {
    const apto = aptoParaFaena(a);
    if (!apto.ok)
      bloqueados.push({ animalId: a.id, caravana: a.caravana, motivo: apto.error ?? "No apto" });
  }
  if (bloqueados.length > 0)
    return {
      ok: false,
      error: `${bloqueados.length} animal(es) no pueden declararse: quitalos o esperá la fecha de fin de carencia.`,
      bloqueados,
    };

  const datos = datosDTeObligatorios({
    origen: input.origen,
    destino: input.destino,
    cantidadAnimales: seleccion.length,
  });
  if (!datos.ok) return { ok: false, error: datos.error!, bloqueados: [] };

  const id = uid("dte_");
  update((db) => {
    const doc: DocumentoTransito = {
      id,
      campoId: input.campoId,
      numeroDTe: input.numeroDTe?.trim() || undefined,
      tipoDocumento: "DT-e",
      fechaEmision: Date.now(),
      origen: input.origen.trim(),
      destino: input.destino.trim(),
      cantidadAnimales: seleccion.length,
      animalIds: seleccion.map((a) => a.id),
      estado: "preparado",
      createdAt: Date.now(),
    };
    db.documentos.push(doc);
  });
  return { ok: true, documentoId: id };
}

export function documentosDe(campoId: string, documentos: DocumentoTransito[]): DocumentoTransito[] {
  return documentos
    .filter((d) => d.campoId === campoId)
    .sort((a, b) => b.createdAt - a.createdAt);
}
