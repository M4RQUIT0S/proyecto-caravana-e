"use client";

import Papa from "papaparse";
import type { Animal } from "./types";
import { loadDB, saveDB, uid } from "./storage";

export interface CsvRow {
  caravana?: string;
  rfid?: string;
  eid?: string;
  id?: string;
  nombre?: string;
  sexo?: string;
  raza?: string;
  categoria?: string;
  fecha_nacimiento?: string;
  peso?: string | number;
  weight?: string | number;
  observaciones?: string;
  lote?: string;
  [key: string]: any;
}

export function parseCSV(text: string): CsvRow[] {
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  return (parsed.data ?? []).filter(Boolean);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export interface ImportResult {
  agregados: number;
  actualizados: number;
  omitidos: number;
}

export function importarAnimales(
  campoId: string,
  rows: CsvRow[],
  opts: { loteId?: string } = {}
): ImportResult {
  const db = loadDB();
  let agregados = 0;
  let actualizados = 0;
  let omitidos = 0;
  const now = Date.now();
  for (const row of rows) {
    const caravana = String(row.caravana ?? row.rfid ?? row.eid ?? row.id ?? "").trim();
    if (!caravana) {
      omitidos++;
      continue;
    }
    const existente = db.animales.find(
      (a) => a.campoId === campoId && a.caravana === caravana
    );
    const datos: Partial<Animal> = {
      caravana,
      nombre: row.nombre ? String(row.nombre) : undefined,
      sexo: row.sexo === "M" || row.sexo === "H" ? row.sexo : undefined,
      raza: row.raza ? String(row.raza) : undefined,
      categoria: row.categoria ? String(row.categoria) : undefined,
      fechaNacimiento: row.fecha_nacimiento ? String(row.fecha_nacimiento) : undefined,
      peso:
        row.peso != null && row.peso !== ""
          ? Number(row.peso)
          : row.weight != null && row.weight !== ""
          ? Number(row.weight)
          : undefined,
      observaciones: row.observaciones ? String(row.observaciones) : undefined,
      loteId: opts.loteId,
    };
    if (existente) {
      Object.assign(existente, datos, { updatedAt: now });
      actualizados++;
    } else {
      db.animales.push({
        id: uid("a_"),
        campoId,
        loteId: opts.loteId,
        caravana,
        ...datos,
        alertas: [],
        createdAt: now,
        updatedAt: now,
      } as Animal);
      agregados++;
    }
  }
  saveDB(db);
  return { agregados, actualizados, omitidos };
}
