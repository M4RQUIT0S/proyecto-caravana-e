import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sincronizarSIGSA, type AnimalParaBot } from "@/lib/sigsa-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Cloud Run/Docker aguanta; en Vercel se ignora si no es Pro

// La web llama a este endpoint desde otro origen → CORS. Se restringe a una allowlist
// (CORS_ORIGIN, separada por comas). Por defecto sólo se permite el propio sitio; "*"
// hay que pedirlo explícitamente. La protección real es el bearer token (ver requireAuth).
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "https://proyecto-caravana-e.vercel.app")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowAny = ALLOWED_ORIGINS.includes("*");
  const allow = allowAny ? "*" : origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
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

// Valida el JWT de Supabase del header Authorization: Bearer <token>.
// Sin un usuario autenticado, el endpoint no procesa nada (cierra el proxy abierto a AFIP).
async function requireAuth(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false; // sin config no se puede validar → se deniega
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.getUser(token);
    return !error && !!data.user;
  } catch {
    return false;
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
  if (!(await requireAuth(req))) {
    return json({ ok: false, mensaje: "No autorizado: iniciá sesión." }, 401, origin);
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

  const resultado = await sincronizarSIGSA({ cuit, clave, acta, loteNombre, animales });
  return json(resultado, resultado.ok ? 200 : 502, origin);
}
