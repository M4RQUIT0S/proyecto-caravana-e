"use client";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { Animal, EventoSanitario, Lote } from "./types";
import { loadDB, uid, update } from "./storage";

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

// Normaliza un encabezado: sin acentos, minúsculas, espacios → "_".
// Así "Número de etiqueta" → "numero_de_etiqueta", "ID electrónico" → "id_electronico".
function normalizarClave(h: string): string {
  return h
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

// Sinónimos de columnas → campo canónico. Cubre exportaciones de software de tacto/RFID
// (Tru-Test/Datamars, etc.) además de los encabezados simples en español/inglés.
const ALIAS_COLUMNA: Record<string, string> = {
  numero_de_etiqueta: "caravana",
  numero_etiqueta: "caravana",
  nro_de_etiqueta: "caravana",
  nro_etiqueta: "caravana",
  n_de_caravana: "caravana",
  numero_de_caravana: "caravana",
  etiqueta: "caravana",
  tag: "caravana",
  vid: "caravana",
  id_electronico: "eid",
  identificacion_electronica: "eid",
  numero_electronico: "eid",
  electronic_id: "eid",
  name: "nombre",
  sex: "sexo",
  genero: "sexo",
  breed: "raza",
  categoria_ok: "categoria",
  category: "categoria",
  fecha_de_nacimiento: "fecha_nacimiento",
  nacimiento: "fecha_nacimiento",
  birth_date: "fecha_nacimiento",
  peso_kg: "peso",
  kg: "peso",
  notas: "observaciones",
  notes: "observaciones",
  obs: "observaciones",
  observacion: "observaciones",
};

// Copia los valores de columnas con nombre alternativo al campo canónico (sin pisar uno ya cargado).
function canonicalizar(row: CsvRow): CsvRow {
  const out: CsvRow = { ...row };
  for (const [src, canon] of Object.entries(ALIAS_COLUMNA)) {
    const actual = out[canon];
    if (actual == null || String(actual).trim() === "") {
      const v = row[src];
      if (v != null && String(v).trim() !== "") out[canon] = v;
    }
  }
  return out;
}

export function parseCSV(text: string): CsvRow[] {
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizarClave,
  });
  return (parsed.data ?? []).filter(Boolean).map(canonicalizar);
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
      const norm = normalizarClave(k);
      out[norm] = typeof row[k] === "string" ? row[k].trim() : row[k];
    }
    return canonicalizar(out);
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
  update((db) => {
    db.lotes.push(lote);
  });
  return lote;
}

// Acepta M/H, Male/Female, Macho/Hembra, Toro/Vaca/Vaquillona, etc.
function normalizarSexo(v: unknown): "M" | "H" | undefined {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return undefined;
  if (s.startsWith("m") || s.startsWith("t")) return "M"; // male, macho, m, toro
  if (s.startsWith("h") || s.startsWith("f") || s.startsWith("v")) return "H"; // hembra, female, f, h, vaca, vaquillona
  return undefined;
}

// ----- Eventos sanitarios desde columnas de tratamiento (vacunas/antiparasitarios) -----
// Archivos de tacto/RFID traen grupos de columnas por producto:
//   "<Producto>", "<Producto> Dosis", "<Producto> Número de lote",
//   "<Producto> Fecha de caducidad", "<Producto> Treated".
// Detectamos cada grupo por su columna "..._treated" y generamos un evento por animal tratado.

function parseFechaISO(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); // YYYY-MM-DD
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/); // DD-MM-YYYY o DD/MM/YYYY
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined;
}

function esAfirmativo(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "yes" || s === "si" || s === "sí" || s === "y" || s === "true" || s === "1";
}

function tituloProducto(base: string): string {
  return base
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

interface GrupoTratamiento {
  base: string;
  nombre: string;
}

export function detectarTratamientos(rows: CsvRow[]): GrupoTratamiento[] {
  const keys = new Set<string>();
  for (const r of rows.slice(0, 30)) for (const k of Object.keys(r)) keys.add(k);
  const grupos: GrupoTratamiento[] = [];
  const vistos = new Set<string>();
  for (const k of keys) {
    if (!k.endsWith("_treated")) continue;
    const base = k.slice(0, -"_treated".length);
    if (!base || vistos.has(base)) continue;
    vistos.add(base);
    grupos.push({ base, nombre: tituloProducto(base) });
  }
  return grupos;
}

export interface ImportResult {
  agregados: number;
  actualizados: number;
  omitidos: number;
  eventos: number;
}

export function importarAnimales(
  campoId: string,
  rows: CsvRow[],
  opts: { loteId?: string; usuarioId?: string } = {}
): ImportResult {
  let agregados = 0;
  let actualizados = 0;
  let omitidos = 0;
  let eventos = 0;
  const now = Date.now();
  const grupos = detectarTratamientos(rows);
  update((db) => {
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
        sexo: normalizarSexo(row.sexo),
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
      let animalId: string;
      if (existente) {
        Object.assign(existente, datos, { updatedAt: now });
        animalId = existente.id;
        actualizados++;
      } else {
        animalId = uid("a_");
        db.animales.push({
          id: animalId,
          campoId,
          loteId: opts.loteId,
          caravana,
          ...datos,
          // estado/activo iniciales para trazabilidad (RN14/RN07)
          estado: "activo",
          activo: true,
          alertas: [],
          createdAt: now,
          updatedAt: now,
        } as Animal);
        agregados++;
      }

      // Eventos sanitarios desde columnas de tratamiento (vacunas/antiparasitarios).
      if (opts.usuarioId && grupos.length) {
        const fechaFila = parseFechaISO(row.fecha);
        for (const g of grupos) {
          const baseVal = row[g.base];
          const fechaProducto = parseFechaISO(baseVal);
          const aplicado = esAfirmativo(row[`${g.base}_treated`]) || fechaProducto != null;
          if (!aplicado) continue;
          const fecha = fechaProducto ?? fechaFila;
          // Evitar duplicar al reimportar el mismo archivo.
          const dup = db.eventos.some(
            (e) =>
              e.tipo === "sanitario" &&
              e.animalId === animalId &&
              (e as EventoSanitario).productoNombre === g.nombre &&
              e.fecha === fecha
          );
          if (dup) continue;
          const dosisNum = Number(row[`${g.base}_dosis`]);
          db.eventos.push({
            id: uid("ev_"),
            tipo: "sanitario",
            campoId,
            animalId,
            usuarioId: opts.usuarioId,
            fechaHora: now,
            fecha,
            observacion: "Importado desde archivo",
            estadoSincronizacion: "local",
            activo: true,
            createdAt: now,
            productoNombre: g.nombre,
            dosis: Number.isFinite(dosisNum) && dosisNum > 0 ? dosisNum : undefined,
            diasCarencia: 0,
          } as EventoSanitario);
          eventos++;
        }
      }
    }
  });
  return { agregados, actualizados, omitidos, eventos };
}
