"use client";

// Capa de sincronización con Supabase. Mantiene la fachada síncrona `db` + `update()`:
//  - hydrate(): baja de Supabase todo lo que el usuario puede ver (RLS) y lo deja en el
//    caché local (localStorage) como DBShape.
//  - pushDiff(prev, next): tras un update() local optimista, empuja a Supabase sólo lo
//    que cambió (upsert/delete por colección). Si Supabase no está configurado o no hay
//    sesión, no hace nada y la app sigue funcionando sólo con localStorage.

import type { Session } from "@supabase/supabase-js";
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
// IMPORTANTE: si se invoca desde el callback de onAuthStateChange hay que pasarle la
// `session` que el callback recibe. Llamar getSession() dentro de ese callback deadlockea
// el navigator lock de supabase-js (la app queda colgada en "Cargando…").
export async function hydrate(sessionArg?: Session | null): Promise<void> {
  if (!supabaseConfigurado()) return; // sin backend: se queda con localStorage
  const sb = supabase();
  let session = sessionArg;
  if (session === undefined) {
    const { data } = await sb.auth.getSession();
    session = data.session;
  }

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
// Separamos inserts de updates: usar .upsert() (ON CONFLICT DO UPDATE) hace que Postgres
// evalúe también la política de UPDATE, que en `campos` consulta la propia tabla por una
// fila que aún no existe durante el insert → RLS la rechaza. Con insert/update separados,
// el INSERT sólo evalúa la política de insert y el UPDATE corre sobre filas existentes.
function diffById<T extends { id: string }>(
  prev: T[],
  next: T[]
): { inserts: T[]; updates: T[]; deleteIds: string[] } {
  const prevMap = new Map(prev.map((x) => [x.id, x]));
  const nextMap = new Map(next.map((x) => [x.id, x]));
  const inserts: T[] = [];
  const updates: T[] = [];
  for (const item of next) {
    const before = prevMap.get(item.id);
    if (!before) inserts.push(item);
    else if (JSON.stringify(before) !== JSON.stringify(item)) updates.push(item);
  }
  const deleteIds: string[] = [];
  for (const item of prev) if (!nextMap.has(item.id)) deleteIds.push(item.id);
  return { inserts, updates, deleteIds };
}

export async function pushDiff(prev: DBShape, next: DBShape): Promise<void> {
  if (!supabaseConfigurado()) return;
  const sb = supabase();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) return;

  const now = () => new Date().toISOString();
  const campoRow = (campo: any) => ({
    id: campo.id,
    owner_id: campo.ownerId,
    codigo: campo.codigo,
    miembros_uuids: (campo.miembros ?? []).map((m: any) => m.userId),
    data: sinAfip(campo), // las credenciales AFIP nunca se suben
    updated_at: now(),
  });
  const dataRow = (obj: any) => ({ id: obj.id, campo_id: obj.campoId, data: obj, updated_at: now() });
  const invRow = (i: any) => ({ id: i.id, campo_id: i.campoId, email: i.email, data: i });

  try {
    // campos (insert primero para respetar FK de las tablas de datos)
    const c = diffById(prev.campos, next.campos);
    if (c.inserts.length) await sb.from("campos").insert(c.inserts.map(campoRow));
    for (const campo of c.updates) await sb.from("campos").update(campoRow(campo)).eq("id", campo.id);
    if (c.deleteIds.length) await sb.from("campos").delete().in("id", c.deleteIds);

    // colecciones simples
    for (const t of DATA_TABLES) {
      const d = diffById((prev as any)[t], (next as any)[t]);
      if (d.inserts.length) await sb.from(t).insert(d.inserts.map(dataRow));
      for (const obj of d.updates) await sb.from(t).update(dataRow(obj)).eq("id", (obj as any).id);
      if (d.deleteIds.length) await sb.from(t).delete().in("id", d.deleteIds);
    }

    // invitaciones
    const inv = diffById(prev.invitaciones, next.invitaciones);
    if (inv.inserts.length) await sb.from("invitaciones").insert(inv.inserts.map(invRow));
    for (const i of inv.updates) await sb.from("invitaciones").update(invRow(i)).eq("id", i.id);
    if (inv.deleteIds.length) await sb.from("invitaciones").delete().in("id", inv.deleteIds);
  } catch (e) {
    console.error("[supabase] pushDiff error:", e);
  }
}

// Registrar el hook para que cada update() local empuje su diff a Supabase.
// Los pushes se serializan en una cola para respetar el orden (p.ej. el campo se
// inserta antes que sus animales, por la FK y el chequeo de membresía).
let registrado = false;
let cola: Promise<void> = Promise.resolve();
let pendientes = 0;

// True mientras haya pushes locales en vuelo. La re-hidratación en segundo plano lo
// consulta para no pisar cambios optimistas que todavía no llegaron a Supabase.
export function syncOcupado(): boolean {
  return pendientes > 0;
}

export function activarSync(): void {
  if (registrado) return;
  registrado = true;
  setSyncHook((prev, next) => {
    pendientes++;
    cola = cola
      .then(() => pushDiff(prev, next))
      .catch((e) => {
        console.error("[supabase] cola de sync:", e);
      })
      .finally(() => {
        pendientes--;
      });
  });
}
