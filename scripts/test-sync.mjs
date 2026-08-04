// Chequeo del camino de sincronización: que un rechazo del servidor (RLS, FK, trigger)
// NO se pierda en silencio. Es el bug que motivó `exigir()`: supabase-js no lanza, devuelve
// el fallo dentro de la respuesta, y descartarlo hacía desaparecer el cambio sin rastro.
//
// El doble se pone en `fetch`, no en el cliente de Supabase: así corre el stack real
// (supabase-js parsea la respuesta de PostgREST y arma su `{ data, error }`) y el test
// sigue siendo válido si mañana cambia la forma de reportar el error.
//
//   npm test
//
// Sin jsdom: se le da a storage.ts el mínimo de navegador que usa (localStorage y los
// eventos), que es EventTarget de Node más un Map.

import assert from "node:assert/strict";

// ---------- navegador mínimo (antes de importar los módulos "use client") ----------
const almacen = new Map();
const localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
  clear: () => almacen.clear(),
};
const ventana = new EventTarget();
ventana.localStorage = localStorage;
globalThis.window = ventana;
globalThis.localStorage = localStorage;
globalThis.document = { cookie: "" };

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://falso.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-de-prueba";

// ---------- doble de red ----------
// `respuesta` decide qué contesta PostgREST en la próxima escritura.
let respuesta = { status: 201, body: [] };
const escrituras = [];

globalThis.fetch = async (url, init = {}) => {
  const metodo = init.method ?? "GET";
  const ruta = String(url);
  if (metodo === "GET") {
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  }
  escrituras.push({ metodo, ruta });
  return new Response(JSON.stringify(respuesta.body), {
    status: respuesta.status,
    headers: { "content-type": "application/json" },
  });
};

const RECHAZO_RLS = {
  status: 403,
  body: {
    code: "42501",
    message: 'new row violates row-level security policy for table "costos"',
  },
};
const ACEPTADO = { status: 201, body: [] };

const { supabase } = await import("../src/lib/supabase/client.ts");
const { activarSync, errorSync, pushDiff, reintentarSync, syncOcupado } = await import(
  "../src/lib/supabase/sync.ts"
);
const { loadDB, saveDB, update } = await import("../src/lib/storage.ts");

// La sesión la resuelve auth desde cookies; acá sólo hace falta que exista. El cliente
// está memoizado, así que sync.ts usa exactamente esta instancia.
const sb = supabase();
sb.auth.getSession = async () => ({
  data: { session: { user: { id: "u1" }, access_token: "t" } },
  error: null,
});

const vacia = () => ({
  usuarios: [], campos: [], lotes: [], animales: [], invitaciones: [], catalogos: [],
  productos: [], proveedores: [], lecturas: [], eventos: [], documentos: [],
  sincronizaciones: [], costos: [], sesion: { userId: "u1" },
});

const costo = (id) => ({ id, campoId: "c1", tipoCosto: "sanidad", monto: 100, createdAt: 1 });

// Espera a que la cola de push termine de procesar (el hook de update() no es awaitable).
const drenar = () => new Promise((r) => setTimeout(r, 20));

// ---------- 1. Un rechazo del servidor tiene que llegar como excepción ----------
respuesta = RECHAZO_RLS;
const conCosto = { ...vacia(), costos: [costo("cost_1")] };
await assert.rejects(
  () => pushDiff(vacia(), conCosto),
  /row-level security/,
  "un rechazo de la RLS debe propagarse, no descartarse"
);

// ---------- 2. Un push aceptado no debe romper ----------
respuesta = ACEPTADO;
await assert.doesNotReject(() => pushDiff(vacia(), conCosto));
assert.ok(escrituras.length >= 2, "las escrituras deben haber salido a la red");

// ---------- 3. Tras un rechazo, el cambio queda marcado y protegido ----------
// De acá en adelante los rechazos son esperados: se captura el console.error del código
// bajo prueba en vez de ensuciar la salida (y se verifica que efectivamente loguea).
const logueados = [];
const errorReal = console.error;
console.error = (...args) => logueados.push(args.join(" "));

saveDB(vacia());
activarSync();
respuesta = RECHAZO_RLS;

update((db) => {
  db.costos.push(costo("cost_2"));
});
await drenar();

assert.match(errorSync() ?? "", /row-level security/, "el fallo debe quedar registrado");
assert.ok(
  logueados.some((l) => l.includes("push rechazado")),
  "el rechazo también tiene que quedar en la consola"
);
assert.equal(syncOcupado(), true, "con un fallo pendiente no se puede re-hidratar encima");
assert.equal(loadDB().costos.length, 1, "el cambio sigue visible localmente");

// ---------- 4. Lo editado DESPUÉS del fallo entra en el mismo reintento ----------
update((db) => {
  db.costos.push(costo("cost_3"));
});
await drenar();
assert.ok(errorSync(), "sigue fallando mientras el servidor rechace");

escrituras.length = 0;
respuesta = ACEPTADO;
assert.equal(await reintentarSync(), true, "el reintento debe salir bien");
console.error = errorReal;
assert.equal(errorSync(), null, "resuelto el fallo, el aviso se limpia");
assert.equal(syncOcupado(), false, "y la re-hidratación vuelve a estar permitida");

const enviados = escrituras.filter((e) => e.ruta.includes("costos"));
assert.ok(
  enviados.length > 0,
  "el reintento debe reenviar los costos, no dar por perdido el diff"
);

// ---------- 5. Sin sesión no se empuja nada (y no explota) ----------
escrituras.length = 0;
sb.auth.getSession = async () => ({ data: { session: null }, error: null });
await assert.doesNotReject(() => pushDiff(vacia(), conCosto));
assert.equal(escrituras.length, 0, "sin sesión no debe escribir");

console.log("OK — los rechazos del servidor se propagan, se avisan y se reintentan.");

// supabase-js deja andando el timer de refresco del token: sin esto el proceso no termina.
process.exit(0);
