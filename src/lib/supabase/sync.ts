"use client";

// Capa de sincronización con Supabase. Mantiene la fachada síncrona `db` + `update()`:
//  - hydrate(): baja de Supabase todo lo que el usuario puede ver (RLS) y lo deja en el
//    caché local (localStorage) como DBShape.
//  - pushDiff(prev, next): tras un update() local optimista, empuja a Supabase sólo lo
//    que cambió (upsert/delete por colección). Si Supabase no está configurado o no hay
//    sesión, no hace nada y la app sigue funcionando sólo con localStorage.

import { loadDB, saveDB, setSyncHook } from "../storage";
import { supabase, supabaseConfigurado } from "./client";
import type { Campo, DBShape } from "../types";

// Las credenciales AFIP del bot SIGSA son SÓLO locales (nunca van al backend).
function sinAfip(campo: Campo): Campo {
  const { afip, ...resto } = campo;
  return resto as Campo;
}

// Colecciones simples: la key del DBShape coincide con el nombre de la tabla.
const DATA_TABLES = [
  "lotes",
  "animales",
  "catalogos",
  "productos",
  "proveedores",
  "lecturas",
  "eventos",
  "documentos",
  "sincronizaciones",
  "costos",
] as const;

type DataTable = (typeof DATA_TABLES)[number];

function emptyDB(): DBShape {
  return {
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
}

// ----------------- Hidratación (Supabase -> caché local) -----------------
export async function hydrate(): Promise<void> {
  if (!supabaseConfigurado()) return; // sin backend: se queda con localStorage
  const sb = supabase();
  const {
    data: { session },
  } = await sb.auth.getSession();

  if (!session) {
    const empty = emptyDB();
    saveDB(empty);
    return;
  }

  const uid = session.user.id;
  const prevLocal = loadDB(); // para preservar credenciales AFIP locales (no se sincronizan)
  const afipPorCampo = new Map(
    prevLocal.campos.filter((c) => c.afip).map((c) => [c.id, c.afip])
  );
  const db = emptyDB();
  db.sesion = { userId: uid };

  const { data: campos } = await sb.from("campos").select("id,data");
  const campoRows = campos ?? [];
  db.campos = campoRows.map((r: any) => {
    const campo = r.data as DBShape["campos"][number];
    const afip = afipPorCampo.get(r.id);
    return afip ? { ...campo, afip } : campo;
  });
  const campoIds = campoRows.map((r: any) => r.id);

  if (campoIds.length > 0) {
    await Promise.all(
      DATA_TABLES.map(async (t) => {
        const { data } = await sb.from(t).select("data").in("campo_id", campoIds);
        (db as any)[t] = (data ?? []).map((r: any) => r.data);
      })
    );
  }

  const { data: invs } = await sb.from("invitaciones").select("data");
  db.invitaciones = (invs ?? []).map((r: any) => r.data);

  // Perfiles: el propio usuario + todos los miembros de sus campos (para mostrar nombres).
  const userIds = new Set<string>([uid]);
  for (const c of db.campos) {
    if (c.ownerId) userIds.add(c.ownerId);
    for (const m of c.miembros ?? []) userIds.add(m.userId);
  }
  const { data: profs } = await sb
    .from("profiles")
    .select("id,username,email,created_at")
    .in("id", Array.from(userIds));
  db.usuarios = (profs ?? []).map((p: any) => ({
    id: p.id,
    username: p.username ?? "",
    email: p.email ?? "",
    passwordHash: "",
    createdAt: p.created_at ? Date.parse(p.created_at) : Date.now(),
  }));
  // Garantizar que el usuario actual exista en la lista (por si el perfil aún no se leyó).
  if (!db.usuarios.some((u) => u.id === uid)) {
    db.usuarios.push({
      id: uid,
      username: (session.user.user_metadata as any)?.username ?? session.user.email ?? "",
      email: session.user.email ?? "",
      passwordHash: "",
      createdAt: Date.now(),
    });
  }

  saveDB(db);
}

// ----------------- Push de cambios (caché local -> Supabase) -----------------
function diffById<T extends { id: string }>(
  prev: T[],
  next: T[]
): { upserts: T[]; deleteIds: string[] } {
  const prevMap = new Map(prev.map((x) => [x.id, x]));
  const nextMap = new Map(next.map((x) => [x.id, x]));
  const upserts: T[] = [];
  for (const item of next) {
    const before = prevMap.get(item.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(item)) upserts.push(item);
  }
  const deleteIds: string[] = [];
  for (const item of prev) if (!nextMap.has(item.id)) deleteIds.push(item.id);
  return { upserts, deleteIds };
}

export async function pushDiff(prev: DBShape, next: DBShape): Promise<void> {
  if (!supabaseConfigurado()) return;
  const sb = supabase();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return;

  try {
    // campos (columnas clave + data)
    const c = diffById(prev.campos, next.campos);
    if (c.upserts.length) {
      await sb.from("campos").upsert(
        c.upserts.map((campo) => ({
          id: campo.id,
          owner_id: campo.ownerId,
          codigo: campo.codigo,
          miembros_uuids: (campo.miembros ?? []).map((m) => m.userId),
          data: sinAfip(campo), // las credenciales AFIP nunca se suben
          updated_at: new Date().toISOString(),
        }))
      );
    }
    if (c.deleteIds.length) await sb.from("campos").delete().in("id", c.deleteIds);

    // colecciones simples
    for (const t of DATA_TABLES) {
      const d = diffById((prev as any)[t], (next as any)[t]);
      if (d.upserts.length) {
        await sb.from(t).upsert(
          d.upserts.map((obj: any) => ({
            id: obj.id,
            campo_id: obj.campoId,
            data: obj,
            updated_at: new Date().toISOString(),
          }))
        );
      }
      if (d.deleteIds.length) await sb.from(t).delete().in("id", d.deleteIds);
    }

    // invitaciones
    const inv = diffById(prev.invitaciones, next.invitaciones);
    if (inv.upserts.length) {
      await sb.from("invitaciones").upsert(
        inv.upserts.map((i) => ({
          id: i.id,
          campo_id: i.campoId,
          email: i.email,
          data: i,
        }))
      );
    }
    if (inv.deleteIds.length) await sb.from("invitaciones").delete().in("id", inv.deleteIds);
  } catch (e) {
    console.error("[supabase] pushDiff error:", e);
  }
}

// Registrar el hook para que cada update() local empuje su diff a Supabase.
let registrado = false;
export function activarSync(): void {
  if (registrado) return;
  registrado = true;
  setSyncHook((prev, next) => {
    void pushDiff(prev, next);
  });
}
