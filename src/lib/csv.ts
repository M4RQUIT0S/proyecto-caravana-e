"use client";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Animal, Lote } from "./types";
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

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(file);
  });
}

export function parseXLSX(buf: ArrayBuffer): CsvRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const ws = wb.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  return rows.map((row) => {
    const out: CsvRow = {};
    for (const k of Object.keys(row)) {
      const norm = k.trim().toLowerCase().replace(/\s+/g, "_");
      out[norm] = typeof row[k] === "string" ? row[k].trim() : row[k];
    }
    return out;
  });
}

export async function parseFile(file: File): Promise<CsvRow[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const buf = await readFileAsArrayBuffer(file);
    return parseXLSX(buf);
  }
  const text = await readFileAsText(file);
  return parseCSV(text);
}

export function nombreBaseSinExtension(filename: string): string {
  return filename.replace(/\.(csv|xlsx|xls)$/i, "").trim() || filename;
}

function modaColumna(rows: CsvRow[], key: keyof CsvRow): string {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = String(r[key as string] ?? "").trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

export interface SugerenciaLote {
  nombre: string;
  categoria: string;
  raza: string;
}

export function sugerirLote(rows: CsvRow[], baseNombre: string): SugerenciaLote {
  return {
    nombre: baseNombre,
    categoria: modaColumna(rows, "categoria"),
    raza: modaColumna(rows, "raza"),
  };
}

export function nombreLoteUnico(campoId: string, base: string): string {
  const db = loadDB();
  const existentes = new Set(
    db.lotes.filter((l) => l.campoId === campoId).map((l) => l.nombre)
  );
  if (!existentes.has(base)) return base;
  let n = 2;
  while (existentes.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

export function crearLoteParaImport(
  campoId: string,
  data: SugerenciaLote
): Lote {
  const lote: Lote = {
    id: uid("l_"),
    campoId,
    nombre: nombreLoteUnico(campoId, data.nombre.trim() || "Lote importado"),
    categoria: data.categoria.trim(),
    raza: data.raza.trim(),
    createdAt: Date.now(),
  };
  const db = loadDB();
  db.lotes.push(lote);
  saveDB(db);
  return lote;
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
