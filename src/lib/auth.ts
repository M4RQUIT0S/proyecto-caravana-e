"use client";

import { passwordValida } from "./password";
import { loadDB, saveDB } from "./storage";
import { supabase, supabaseConfigurado } from "./supabase/client";
import { hydrate } from "./supabase/sync";
import type { Rol, Usuario } from "./types";

type AuthResult = { ok: true; user: Usuario } | { ok: false; error: string };
type SimpleResult = { ok: true } | { ok: false; error: string };

function traducir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email o contraseña incorrectos.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ya existe una cuenta con ese correo.";
  if (m.includes("password")) return "La contraseña no cumple los requisitos de seguridad.";
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
  if (!passwordValida(input.password))
    return {
      ok: false,
      error:
        "La contraseña debe tener al menos 8 caracteres e incluir mayúscula, " +
        "minúscula, número y un símbolo especial.",
    };

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

// Login con proveedor externo (Google). Redirige al proveedor y vuelve a
// /auth/callback, donde se completa el intercambio del code por la sesión.
export async function iniciarOAuth(provider: "google" = "google"): Promise<SimpleResult> {
  if (!supabaseConfigurado())
    return { ok: false, error: "Falta configurar Supabase (variables de entorno)." };
  const sb = supabase();
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("provider is not enabled"))
      return { ok: false, error: "El inicio de sesión con Google no está habilitado todavía." };
    return { ok: false, error: traducir(error.message) };
  }
  return { ok: true };
}

// Envía el correo de recuperación. Por seguridad, Supabase responde igual exista o no
// el correo (evita revelar qué mails están registrados); siempre devolvemos ok.
export async function enviarRecuperacion(email: string): Promise<SimpleResult> {
  if (!supabaseConfigurado())
    return { ok: false, error: "Falta configurar Supabase (variables de entorno)." };
  const correo = email.trim().toLowerCase();
  if (!correo || !correo.includes("@"))
    return { ok: false, error: "Ingresá un correo válido." };
  const sb = supabase();
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/restablecer`
      : undefined;
  await sb.auth.resetPasswordForEmail(correo, { redirectTo });
  return { ok: true };
}

// Fija una contraseña nueva (la sesión de recuperación ya está activa por el link del mail).
export async function cambiarPassword(nueva: string): Promise<SimpleResult> {
  if (!supabaseConfigurado())
    return { ok: false, error: "Falta configurar Supabase (variables de entorno)." };
  if (!passwordValida(nueva))
    return {
      ok: false,
      error:
        "La contraseña debe tener al menos 8 caracteres e incluir mayúscula, " +
        "minúscula, número y un símbolo especial.",
    };
  const sb = supabase();
  const { error } = await sb.auth.updateUser({ password: nueva });
  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("session") || m.includes("jwt") || m.includes("not authenticated"))
      return {
        ok: false,
        error: "El enlace expiró o no es válido. Pedí uno nuevo desde 'Olvidé mi contraseña'.",
      };
    return { ok: false, error: traducir(error.message) };
  }
  return { ok: true };
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
