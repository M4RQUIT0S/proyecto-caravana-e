"use client";

import type { DBShape } from "./types";

const KEY = "caravanas:v1";

const empty: DBShape = {
  usuarios: [],
  campos: [],
  lotes: [],
  animales: [],
  invitaciones: [],
  catalogos: [],
  productos: [],
  proveedores: [],
  lecturas: [],
  eventos: [],
  documentos: [],
  sincronizaciones: [],
  costos: [],
  sesion: { userId: null },
};

export function loadDB(): DBShape {
  if (typeof window === "undefined") return structuredClone(empty);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return structuredClone(empty);
    const parsed = JSON.parse(raw);
    return { ...empty, ...parsed };
  } catch {
    return structuredClone(empty);
  }
}

export function saveDB(db: DBShape) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(db));
  window.dispatchEvent(new CustomEvent("caravanas:update"));
}

// Hook opcional: si la capa Supabase lo registra, cada update() empuja su diff al backend.
type SyncHook = (prev: DBShape, next: DBShape) => void;
let syncHook: SyncHook | null = null;
export function setSyncHook(fn: SyncHook | null) {
  syncHook = fn;
}

export function update<T>(fn: (db: DBShape) => T): T {
  const db = loadDB();
  const prev: DBShape =
    typeof structuredClone === "function"
      ? structuredClone(db)
      : JSON.parse(JSON.stringify(db));
  const result = fn(db);
  saveDB(db);
  if (syncHook) {
    try {
      syncHook(prev, db);
    } catch (e) {
      console.error("[storage] syncHook error:", e);
    }
  }
  return result;
}

// Id de entidad. Es la clave primaria en Postgres y la generan varios dispositivos sin
// coordinarse, así que se usa randomUUID (CSPRNG) en vez de Math.random: dos equipos
// cargando animales a la vez no pueden chocar. El prefijo queda sólo para poder leer de
// un vistazo de qué tabla es un id; nadie lo parsea.
export function uid(prefix = ""): string {
  if (crypto.randomUUID) return `${prefix}${crypto.randomUUID()}`;
  // randomUUID exige contexto seguro y no lo hay al probar desde el celular por IP de
  // LAN (http://192.168.x.x:3000). getRandomValues sí anda ahí, y da lo mismo.
  const b = crypto.getRandomValues(new Uint8Array(16));
  return `${prefix}${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function codigoCampo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 símbolos sin ambiguos (0/O, 1/I)
  // Código de acceso a un campo → se genera con CSPRNG (no Math.random, predecible).
  // 8 caracteres = 32^8 ≈ 40 bits: encarece la enumeración de códigos (unirse da sólo
  // rol "vista", pero igual subimos la barrera). Los códigos viejos de 6 chars siguen
  // siendo válidos; esto sólo afecta a los campos nuevos.
  const LARGO = 8;
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  let s = "";
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(LARGO);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < LARGO; i++) s += chars[buf[i] % chars.length];
  } else {
    for (let i = 0; i < LARGO; i++) s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}
