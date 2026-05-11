"use client";

import { loadDB, saveDB, uid, update } from "./storage";
import type { Rol, Usuario } from "./types";

// Hash simple (sólo para demo client-side). En producción usar backend real.
async function hash(text: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return btoa(unescape(encodeURIComponent(text)));
  }
  const data = new TextEncoder().encode(text);
  const buf = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function registrar(input: {
  email: string;
  username: string;
  password: string;
}): Promise<{ ok: true; user: Usuario } | { ok: false; error: string }> {
  const db = loadDB();
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  if (!email || !username || !input.password) {
    return { ok: false, error: "Completá todos los campos." };
  }
  if (input.password.length < 6) {
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }
  if (db.usuarios.some((u) => u.email === email)) {
    return { ok: false, error: "Ya existe una cuenta con ese correo." };
  }
  if (db.usuarios.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: "Ese nombre de usuario ya está tomado." };
  }
  const user: Usuario = {
    id: uid("u_"),
    email,
    username,
    passwordHash: await hash(input.password),
    createdAt: Date.now(),
  };
  db.usuarios.push(user);
  db.sesion = { userId: user.id };
  saveDB(db);
  return { ok: true, user };
}

export async function login(
  identificador: string,
  password: string
): Promise<{ ok: true; user: Usuario } | { ok: false; error: string }> {
  const db = loadDB();
  const id = identificador.trim().toLowerCase();
  const user = db.usuarios.find(
    (u) => u.email === id || u.username.toLowerCase() === id
  );
  if (!user) return { ok: false, error: "Usuario no encontrado." };
  const ph = await hash(password);
  if (ph !== user.passwordHash) return { ok: false, error: "Contraseña incorrecta." };
  db.sesion = { userId: user.id };
  saveDB(db);
  return { ok: true, user };
}

export function logout() {
  update((db) => {
    db.sesion = { userId: null };
  });
}

export function currentUser(): Usuario | null {
  const db = loadDB();
  if (!db.sesion.userId) return null;
  return db.usuarios.find((u) => u.id === db.sesion.userId) ?? null;
}

export function rolEnCampo(userId: string, campoId: string): Rol | null {
  const db = loadDB();
  const campo = db.campos.find((c) => c.id === campoId);
  if (!campo) return null;
  if (campo.ownerId === userId) return "admin";
  const m = campo.miembros.find((mm) => mm.userId === userId);
  return m ? m.rol : null;
}
