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
  const rows = sanitizarFilas(animalesARows(animales, lotes));
  const csv = Papa.unparse(rows);
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  descargarBlob(blob, nombreArchivo(base, "csv"));
}

export function exportarAnimalesXLSX(
  animales: Animal[],
  lotes: Lote[],
  base = "animales"
) {
  const rows = sanitizarFilas(animalesARows(animales, lotes));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Animales");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  descargarBlob(blob, nombreArchivo(base, "xlsx"));
}
