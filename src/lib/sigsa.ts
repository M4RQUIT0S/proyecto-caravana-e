"use client";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { sanitizarFilas } from "./csv-safe";
import { cifrarSecreto } from "./secure-store";
import type { Animal, AfipCredenciales, Lote } from "./types";
import { update } from "./storage";

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

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const rows = sanitizarFilas(animalesARowsSigsa(animales, acta));
  const csv = Papa.unparse(rows);
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  descargarBlob(blob, nombreArchivoSigsa(loteNombre, "csv"));
}

export function exportarPendientesXLSX(
  animales: Animal[],
  loteNombre: string,
  acta: string
) {
  const rows = sanitizarFilas(animalesARowsSigsa(animales, acta));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SIGSA");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  descargarBlob(blob, nombreArchivoSigsa(loteNombre, "xlsx"));
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
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem("caravanas:v1");
    if (!raw) return undefined;
    const db = JSON.parse(raw);
    const c = db.campos?.find((x: { id: string }) => x.id === campoId);
    return c?.afip;
  } catch {
    return undefined;
  }
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
