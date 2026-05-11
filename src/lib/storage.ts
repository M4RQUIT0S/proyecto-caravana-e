"use client";

import type { DBShape } from "./types";

const KEY = "caravanas:v1";

const empty: DBShape = {
  usuarios: [],
  campos: [],
  lotes: [],
  animales: [],
  invitaciones: [],
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

export function update<T>(fn: (db: DBShape) => T): T {
  const db = loadDB();
  const result = fn(db);
  saveDB(db);
  return result;
}

export function uid(prefix = ""): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}${time}${rand}`;
}

export function codigoCampo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
