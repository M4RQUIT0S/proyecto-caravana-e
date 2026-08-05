"use client";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { sanitizarFilas } from "./csv-safe";
import type { Animal, Lote } from "./types";

export interface ExportRow {
  caravana: string;
  nombre: string;
  sexo: string;
  raza: string;
  categoria: string;
  peso: string | number;
  fecha_nacimiento: string;
  lote: string;
  observaciones: string;
  alertas_activas: number;
}

function animalesARows(animales: Animal[], lotes: Lote[]): ExportRow[] {
  return animales.map((a) => {
    const lote = lotes.find((l) => l.id === a.loteId);
    return {
      caravana: a.caravana,
      nombre: a.nombre ?? "",
      sexo: a.sexo === "M" ? "Macho" : a.sexo === "H" ? "Hembra" : "",
      raza: a.raza ?? "",
      categoria: a.categoria ?? "",
      peso: a.peso ?? "",
      fecha_nacimiento: a.fechaNacimiento ?? "",
      lote: lote?.nombre ?? "",
      observaciones: a.observaciones ?? "",
      alertas_activas: a.alertas.filter((al) => !al.resuelta).length,
    };
  });
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

// Escritores compartidos por todas las exportaciones (animales y SIGSA). Aplican
// `sanitizarFilas` acá adentro: así ninguna exportación futura puede olvidarse el
// saneo anti-fórmula (CWE-1236). El BOM hace que Excel abra el CSV en UTF-8.
export function descargarCSV<T extends object>(rows: T[], filename: string) {
  const csv = Papa.unparse(sanitizarFilas(rows));
  descargarBlob(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" }), filename);
}

export function descargarXLSX<T extends object>(rows: T[], filename: string, hoja: string) {
  const ws = XLSX.utils.json_to_sheet(sanitizarFilas(rows));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  descargarBlob(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename
  );
}

function nombreArchivo(base: string, ext: string): string {
  const d = new Date();
  const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `${base}-${ts}.${ext}`;
}

export function exportarAnimalesCSV(
  animales: Animal[],
  lotes: Lote[],
  base = "animales"
) {
  descargarCSV(animalesARows(animales, lotes), nombreArchivo(base, "csv"));
}

export function exportarAnimalesXLSX(
  animales: Animal[],
  lotes: Lote[],
  base = "animales"
) {
  descargarXLSX(animalesARows(animales, lotes), nombreArchivo(base, "xlsx"), "Animales");
}
