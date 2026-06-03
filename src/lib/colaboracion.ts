"use client";

// Flujos de colaboración que cruzan la frontera de RLS (un no-miembro necesita acceso):
// unirse por código y aceptar/rechazar invitación. Usan RPCs SECURITY DEFINER del schema.
// La gestión del lado del Productor (invitar, cambiar rol, baja) usa update() normal,
// porque el owner ya tiene permiso de escritura sobre su campo.

import { supabase, supabaseConfigurado } from "./supabase/client";
import { hydrate } from "./supabase/sync";

type Res = { ok: true; campoId?: string } | { ok: false; error: string };

export async function unirmeConCodigo(codigo: string): Promise<Res> {
  if (!supabaseConfigurado()) return { ok: false, error: "Supabase no configurado." };
  const cod = codigo.trim().toUpperCase();
  if (!cod) return { ok: false, error: "Ingresá un código." };
  const { data, error } = await supabase().rpc("unirme_con_codigo", { p_codigo: cod });
  if (error) return { ok: false, error: error.message };
  switch (data) {
    case "NO_ENCONTRADO":
      return { ok: false, error: "Código no encontrado." };
    case "YA_OWNER":
      return { ok: false, error: "Ya sos el administrador de este campo." };
    case "YA_MIEMBRO":
      return { ok: false, error: "Ya sos miembro de este campo." };
    default:
      await hydrate();
      return { ok: true, campoId: data as string };
  }
}

export async function aceptarInvitacion(id: string): Promise<Res> {
  if (!supabaseConfigurado()) return { ok: false, error: "Supabase no configurado." };
  const { data, error } = await supabase().rpc("aceptar_invitacion", { p_inv_id: id });
  if (error) return { ok: false, error: error.message };
  if (data === "NO_ENCONTRADO") return { ok: false, error: "La invitación ya no existe." };
  if (data === "NO_AUTORIZADO") return { ok: false, error: "Esta invitación no es para tu cuenta." };
  await hydrate();
  return { ok: true, campoId: data as string };
}

export async function rechazarInvitacion(id: string): Promise<void> {
  if (!supabaseConfigurado()) return;
  await supabase().from("invitaciones").delete().eq("id", id);
  await hydrate();
}
