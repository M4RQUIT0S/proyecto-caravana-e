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

// supabase-js NO lanza cuando Postgres rechaza (RLS, FK, trigger): devuelve el fallo en
// `error` dentro de la respuesta. Si no se mira ese campo, un rechazo pasa totalmente
// inadvertido y el cambio queda sólo en localStorage hasta que la próxima hydrate() lo
// pisa. Toda escritura pasa por acá para convertir ese `error` en una excepción real.
// Rechazo del servidor: no se arregla reintentando solo (hace falta permiso, corregir el
// dato o volver a entrar). Se distingue de una caída de red, que sí se resuelve sola.
export class RechazoServidor extends Error {}

async function exigir(
  op: PromiseLike<{ error: { message: string } | null; status: number }>,
  que: string
): Promise<void> {
  const { error, status } = await op;
  if (!error) return;
  // supabase-js también envuelve la caída de red en `error`, así que el mensaje no
  // alcanza para distinguirla. El que sí distingue es el status: 0 significa que el
  // fetch nunca llegó a completarse (sin señal); con cualquier status el servidor
  // contestó y rechazó, que es lo único que no se arregla reintentando solo.
  if (!status) throw new Error(`${que}: ${error.message}`);
  throw new RechazoServidor(`${que}: ${error.message}`);
}

export async function pushDiff(prev: DBShape, next: DBShape): Promise<void> {
  if (!supabaseConfigurado()) return;
  const sb = supabase();
  const {
    data: { session },
  } = await sb.auth.getSession();
  // Sin sesión no hay a dónde escribir. Antes se devolvía en silencio y el cambio moría
  // en localStorage: si el token vence con la app abierta, lo editado se perdía sin aviso.
  if (!session)
    throw new RechazoServidor(
      "la sesión expiró — volvé a iniciar sesión para guardar los cambios"
    );

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

  // campos (insert primero para respetar FK de las tablas de datos)
  const c = diffById(prev.campos, next.campos);
  if (c.inserts.length) await exigir(sb.from("campos").insert(c.inserts.map(campoRow)), "campos");
  for (const campo of c.updates)
    await exigir(sb.from("campos").update(campoRow(campo)).eq("id", campo.id), "campos");
  if (c.deleteIds.length) await exigir(sb.from("campos").delete().in("id", c.deleteIds), "campos");

  // colecciones simples
  for (const t of DATA_TABLES) {
    const d = diffById((prev as any)[t], (next as any)[t]);
    if (d.inserts.length) await exigir(sb.from(t).insert(d.inserts.map(dataRow)), t);
    for (const obj of d.updates)
      await exigir(sb.from(t).update(dataRow(obj)).eq("id", (obj as any).id), t);
    if (d.deleteIds.length) await exigir(sb.from(t).delete().in("id", d.deleteIds), t);
  }

  // invitaciones
  const inv = diffById(prev.invitaciones, next.invitaciones);
  if (inv.inserts.length)
    await exigir(sb.from("invitaciones").insert(inv.inserts.map(invRow)), "invitaciones");
  for (const i of inv.updates)
    await exigir(sb.from("invitaciones").update(invRow(i)).eq("id", i.id), "invitaciones");
  if (inv.deleteIds.length)
    await exigir(sb.from("invitaciones").delete().in("id", inv.deleteIds), "invitaciones");
}

// Registrar el hook para que cada update() local empuje su diff a Supabase.
// Los pushes se serializan en una cola para respetar el orden (p.ej. el campo se
// inserta antes que sus animales, por la FK y el chequeo de membresía).
let registrado = false;
let cola: Promise<void> = Promise.resolve();
let pendientes = 0;

// Estado del último push que no llegó al servidor, y la base desde la cual reintentar.
// Se separan dos causas porque ameritan reacciones distintas:
//   - `fallo`: el servidor lo RECHAZÓ (RLS, validación, sesión vencida). No se arregla
//     solo: hay que avisarle a la persona.
//   - `sinRed`: no hubo conexión. Es el modo de trabajo normal en el campo, así que no
//     se alarma a nadie: se reintenta apenas vuelve la señal.
// Mientras cualquiera de los dos esté activo hay cambios que viven SÓLO en este navegador.
let fallo: string | null = null;
let sinRed = false;
let baseFallo: DBShape | null = null;

function avisar() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("caravanas:sync"));
}

// Sólo los rechazos del servidor se muestran; la falta de red la cubre el indicador de
// conectividad que ya tiene la app.
export function errorSync(): string | null {
  return fallo;
}

// True mientras haya cambios locales que el servidor todavía no confirmó. La
// re-hidratación en segundo plano lo consulta para no pisar con los datos del servidor
// algo que acá no llegó a guardarse.
export function syncOcupado(): boolean {
  return pendientes > 0 || fallo !== null || sinRed;
}

// Todo push pasa por esta cola —incluidos los reintentos— para que no se pisen entre sí
// y se respete el orden (el campo se inserta antes que sus animales, por la FK).
// `siguiente` es una función porque el reintento tiene que leer el estado del momento en
// que le toca el turno, no el de cuando se encoló.
function encolar(base: DBShape, siguiente: () => DBShape): Promise<boolean> {
  pendientes++;
  // Si quedó un fallo sin resolver, el diff arranca de ahí: empujar sólo desde `base`
  // dejaría afuera los cambios que el servidor ya había rechazado.
  const intento = cola
    .then(async () => {
      await pushDiff(baseFallo ?? base, siguiente());
      baseFallo = null;
      fallo = null;
      sinRed = false;
      return true;
    })
    .catch((e: unknown) => {
      baseFallo ??= base;
      if (e instanceof RechazoServidor) {
        fallo = e.message;
        console.error("[supabase] push rechazado:", e);
      } else {
        // Caída de red (fetch no resuelve): normal sin señal, se reintenta al volver.
        sinRed = true;
      }
      return false;
    })
    .finally(() => {
      pendientes--;
      avisar();
    });
  cola = intento.then(() => {});
  return intento;
}

// Reintenta desde el último estado confirmado, arrastrando también lo editado después
// del fallo. Devuelve si quedó todo sincronizado.
export function reintentarSync(): Promise<boolean> {
  if (!fallo && !sinRed) return Promise.resolve(true);
  return encolar(baseFallo ?? loadDB(), loadDB);
}

export function activarSync(): void {
  if (registrado) return;
  registrado = true;
  setSyncHook((prev, next) => {
    void encolar(prev, () => next);
  });
  // Al volver la señal se sube solo lo que quedó pendiente: sin esto, un cambio hecho
  // sin conexión se quedaba esperando a la próxima edición para intentar subir.
  if (typeof window !== "undefined")
    window.addEventListener("online", () => void reintentarSync());
}
