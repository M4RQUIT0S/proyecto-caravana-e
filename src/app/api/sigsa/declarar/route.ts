import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sincronizarSIGSA, type AnimalParaBot } from "@/lib/sigsa-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Cloud Run/Docker aguanta; en Vercel se ignora si no es Pro

// La web llama a este endpoint desde otro origen → CORS. Se restringe a una allowlist
// (CORS_ORIGIN, separada por comas). "*" hay que pedirlo explícitamente. La protección
// real es el bearer token (ver requireAuth).
//
// El default sale del propio despliegue, no de un host escrito a mano: Vercel inyecta el
// dominio de producción y el de esta deploy. Acá había un host fijo y quedó obsoleto en
// cuanto el proyecto pasó a servirse desde otra URL — el endpoint respondía con el
// Access-Control-Allow-Origin del sitio viejo y el navegador bloqueaba la llamada.
const SELF_ORIGINS = [
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  process.env.VERCEL_URL,
]
  .filter((h): h is string => Boolean(h))
  .map((h) => `https://${h}`);

const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : SELF_ORIGINS
)
  .map((o) => o.trim())
  .filter(Boolean);

// Tope de payload: una declaración no debería traer más animales que una tropa grande.
// Acota el costo del login Playwright→AFIP y evita payloads abusivos (DoS).
const MAX_ANIMALES = 5000;

// Rate-limit best-effort en memoria, por usuario. En serverless cada instancia tiene su
// propio Map, así que NO es un límite global duro; alcanza para frenar el abuso desde una
// sola sesión sin sumar infra. Para un límite estricto haría falta un store compartido
// (Upstash/Supabase). El bot es pesado y poco frecuente, así que 5/min es holgado.
const RATE_MAX = 5;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recientes = (hits.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recientes.length >= RATE_MAX) {
    hits.set(userId, recientes);
    return true;
  }
  recientes.push(now);
  hits.set(userId, recientes);
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowAny = ALLOWED_ORIGINS.includes("*");
  const allow = allowAny
    ? "*"
    : origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] ?? "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
}

// Valida el JWT de Supabase del header Authorization: Bearer <token> y devuelve el id del
// usuario (o null). Sin un usuario autenticado, el endpoint no procesa nada (cierra el
// proxy abierto a AFIP). El id se usa además como clave del rate-limit.
async function authUser(req: Request): Promise<{ id: string } | null> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null; // sin config no se puede validar → se deniega
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id };
  } catch {
    return null;
  }
}

// Preflight CORS.
export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

// Health check (para el host: Cloud Run / Render / Railway). No expone datos.
export function GET(req: Request) {
  return json({ ok: true, service: "sigsa-bot", ts: Date.now() }, 200, req.headers.get("origin"));
}

interface ReqBody {
  cuit?: string;
  clave?: string;
  acta?: string;
  loteNombre?: string;
  animales?: AnimalParaBot[];
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  // Autenticación obligatoria: sólo usuarios con sesión Supabase válida pueden usar el bot
  // (la Clave Fiscal de AFIP transita acá; sin esto sería un proxy abierto a AFIP).
  const user = await authUser(req);
  if (!user) {
    return json({ ok: false, mensaje: "No autorizado: iniciá sesión." }, 401, origin);
  }
  if (rateLimited(user.id)) {
    return json(
      { ok: false, mensaje: "Demasiadas solicitudes. Esperá un minuto e intentá de nuevo." },
      429,
      origin
    );
  }

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, mensaje: "Body inválido (JSON requerido)." }, 400, origin);
  }

  const cuit = body.cuit?.replace(/\D/g, "") ?? "";
  const clave = body.clave ?? "";
  const acta = body.acta?.trim() ?? "";
  const loteNombre = body.loteNombre?.trim() || "lote";
  const animales = Array.isArray(body.animales) ? body.animales : [];

  if (cuit.length !== 11) {
    return json({ ok: false, mensaje: "CUIT inválido — debe tener 11 dígitos." }, 400, origin);
  }
  if (!clave) {
    return json({ ok: false, mensaje: "Falta la Clave Fiscal." }, 400, origin);
  }
  if (!acta) {
    return json({ ok: false, mensaje: "Falta el número de acta de vacunación." }, 400, origin);
  }
  if (animales.length === 0) {
    return json({ ok: false, mensaje: "No hay caravanas para declarar." }, 400, origin);
  }
  if (animales.length > MAX_ANIMALES) {
    return json(
      { ok: false, mensaje: `Demasiados animales en una sola declaración (máx ${MAX_ANIMALES}).` },
      413,
      origin
    );
  }

  const resultado = await sincronizarSIGSA({ cuit, clave, acta, loteNombre, animales });
  return json(resultado, resultado.ok ? 200 : 502, origin);
}
