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

export function uid(prefix = ""): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}${time}${rand}`;
}

export function codigoCampo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  // Código de acceso a un campo → se genera con CSPRNG (no Math.random, predecible).
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  let s = "";
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(6);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < 6; i++) s += chars[buf[i] % chars.length];
  } else {
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}
