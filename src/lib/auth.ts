"use client";

import { loadDB, saveDB } from "./storage";
import { supabase, supabaseConfigurado } from "./supabase/client";
import { hydrate } from "./supabase/sync";
import type { Rol, Usuario } from "./types";

type AuthResult = { ok: true; user: Usuario } | { ok: false; error: string };

function traducir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email o contraseña incorrectos.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ya existe una cuenta con ese correo.";
  if (m.includes("password")) return "La contraseña no cumple los requisitos (mínimo 6 caracteres).";
  if (m.includes("email")) return "El correo no es válido.";
  return msg;
}

export async function registrar(input: {
  email: string;
  username: string;
  password: string;
}): Promise<AuthResult> {
  if (!supabaseConfigurado())
    return { ok: false, error: "Falta configurar Supabase (variables de entorno)." };

  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  if (!email || !username || !input.password)
    return { ok: false, error: "Completá todos los campos." };
  if (input.password.length < 6)
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };

  const sb = supabase();

  // Username único (la columna profiles.username es unique; chequeamos antes para un mensaje claro).
  const { data: existente } = await sb
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existente) return { ok: false, error: "Ese nombre de usuario ya está tomado." };

  const { data, error } = await sb.auth.signUp({
    email,
    password: input.password,
    options: { data: { username } },
  });
  if (error) return { ok: false, error: traducir(error.message) };

  if (!data.session) {
    // El proyecto tiene confirmación de email activada.
    return {
      ok: false,
      error:
        "Te enviamos un correo para confirmar la cuenta. Confirmala y luego iniciá sesión. " +
        "(Para registro inmediato, desactivá 'Confirm email' en Supabase → Auth.)",
    };
  }

  await hydrate();
  const user = currentUser();
  return user ? { ok: true, user } : { ok: false, error: "No se pudo iniciar la sesión." };
}

export async function login(identificador: string, password: string): Promise<AuthResult> {
  if (!supabaseConfigurado())
    return { ok: false, error: "Falta configurar Supabase (variables de entorno)." };

  const sb = supabase();
  let email = identificador.trim();
  if (!email.includes("@")) {
    // Login por nombre de usuario: resolvemos su email vía RPC.
    const { data } = await sb.rpc("email_for_username", { p_username: email });
    if (!data) return { ok: false, error: "Usuario no encontrado." };
    email = data as string;
  }

  const { error } = await sb.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });
  if (error) return { ok: false, error: traducir(error.message) };

  await hydrate();
  const user = currentUser();
  return user ? { ok: true, user } : { ok: false, error: "No se pudo iniciar la sesión." };
}

export async function logout() {
  if (supabaseConfigurado()) {
    try {
      await supabase().auth.signOut();
    } catch {}
  }
  const db = loadDB();
  db.sesion = { userId: null };
  saveDB(db);
}

// Lee del caché local (hidratado desde Supabase). Sincrónico para no tocar el resto de la app.
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
