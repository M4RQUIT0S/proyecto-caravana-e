"use client";

import { descargarCSV, descargarXLSX } from "./export";
import { cifrarSecreto } from "./secure-store";
import type { Animal, AfipCredenciales, Lote } from "./types";
import { loadDB, update } from "./storage";

export interface SigsaRow {
  acta: string;
  caravana: string;
  sexo: string;
  raza: string;
  categoria: string;
  fecha_nacimiento: string;
}

export interface ResumenLoteSigsa {
  lote: Lote;
  pendientes: Animal[];
  declarados: number;
  total: number;
}

export function pendientesDeLote(animales: Animal[], loteId: string): Animal[] {
  return animales.filter((a) => a.loteId === loteId && !a.sigsa);
}

export function resumenPorLote(
  lotes: Lote[],
  animales: Animal[]
): ResumenLoteSigsa[] {
  return lotes.map((lote) => {
    const delLote = animales.filter((a) => a.loteId === lote.id);
    const pendientes = delLote.filter((a) => !a.sigsa);
    return {
      lote,
      pendientes,
      declarados: delLote.length - pendientes.length,
      total: delLote.length,
    };
  });
}

export function totalPendientes(animales: Animal[]): number {
  return animales.filter((a) => !a.sigsa).length;
}

function animalesARowsSigsa(animales: Animal[], acta: string): SigsaRow[] {
  return animales.map((a) => ({
    acta,
    caravana: a.caravana,
    sexo: a.sexo === "M" ? "Macho" : a.sexo === "H" ? "Hembra" : "",
    raza: a.raza ?? "",
    categoria: a.categoria ?? "",
    fecha_nacimiento: a.fechaNacimiento ?? "",
  }));
}

function nombreArchivoSigsa(loteNombre: string, ext: string): string {
  const slug =
    loteNombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "lote";
  const d = new Date();
  const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `sigsa-${slug}-${ts}.${ext}`;
}

export function exportarPendientesCSV(
  animales: Animal[],
  loteNombre: string,
  acta: string
) {
  descargarCSV(animalesARowsSigsa(animales, acta), nombreArchivoSigsa(loteNombre, "csv"));
}

export function exportarPendientesXLSX(
  animales: Animal[],
  loteNombre: string,
  acta: string
) {
  descargarXLSX(
    animalesARowsSigsa(animales, acta),
    nombreArchivoSigsa(loteNombre, "xlsx"),
    "SIGSA"
  );
}

export interface MarcadoResultado {
  marcados: number;
  yaDeclarados: number;
}

export function marcarComoDeclarados(
  animalIds: string[],
  declaradoPor: string,
  acta?: string
): MarcadoResultado {
  let marcados = 0;
  let yaDeclarados = 0;
  const now = Date.now();
  const actaLimpia = acta?.trim() || undefined;
  update((db) => {
    for (const id of animalIds) {
      const a = db.animales.find((x) => x.id === id);
      if (!a) continue;
      if (a.sigsa) {
        yaDeclarados++;
        continue;
      }
      a.sigsa = { declaradoAt: now, declaradoPor, acta: actaLimpia };
      a.updatedAt = now;
      marcados++;
    }
  });
  return { marcados, yaDeclarados };
}

export async function guardarCredencialesAfip(
  campoId: string,
  cuit: string,
  clave: string
) {
  const limpio = cuit.replace(/\D/g, "");
  // La Clave Fiscal se cifra en reposo (AES-GCM, clave de dispositivo en IndexedDB).
  const claveCifrada = await cifrarSecreto(clave);
  update((db) => {
    const c = db.campos.find((x) => x.id === campoId);
    if (!c) return;
    c.afip = { cuit: limpio, clave: claveCifrada, guardadoAt: Date.now() };
  });
}

export function borrarCredencialesAfip(campoId: string) {
  update((db) => {
    const c = db.campos.find((x) => x.id === campoId);
    if (!c) return;
    c.afip = undefined;
  });
}

export function obtenerCredencialesAfip(campoId: string): AfipCredenciales | undefined {
  return loadDB().campos.find((c) => c.id === campoId)?.afip;
}

export function formatCuit(cuit: string): string {
  const d = cuit.replace(/\D/g, "");
  if (d.length !== 11) return cuit;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export function deshacerDeclaracion(animalIds: string[]): number {
  let deshechos = 0;
  const now = Date.now();
  update((db) => {
    for (const id of animalIds) {
      const a = db.animales.find((x) => x.id === id);
      if (!a || !a.sigsa) continue;
      a.sigsa = undefined;
      a.updatedAt = now;
      deshechos++;
    }
  });
  return deshechos;
}
