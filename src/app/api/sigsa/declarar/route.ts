import { NextResponse } from "next/server";
import { sincronizarSIGSA, type AnimalParaBot } from "@/lib/sigsa-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Cloud Run/Docker aguanta; en Vercel se ignora si no es Pro

// La web (Vercel) llama a este endpoint desde otro origen → hace falta CORS.
// Se puede restringir con CORS_ORIGIN; por defecto permite cualquier origen (no usa cookies).
const ORIGIN = process.env.CORS_ORIGIN || "*";
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

// Preflight CORS.
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Health check (para el host: Cloud Run / Render / Railway).
export function GET() {
  return json({ ok: true, service: "sigsa-bot", ts: Date.now() });
}

interface ReqBody {
  cuit?: string;
  clave?: string;
  acta?: string;
  loteNombre?: string;
  animales?: AnimalParaBot[];
}

export async function POST(req: Request) {
  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, mensaje: "Body inválido (JSON requerido)." }, 400);
  }

  const cuit = body.cuit?.replace(/\D/g, "") ?? "";
  const clave = body.clave ?? "";
  const acta = body.acta?.trim() ?? "";
  const loteNombre = body.loteNombre?.trim() || "lote";
  const animales = Array.isArray(body.animales) ? body.animales : [];

  if (cuit.length !== 11) {
    return json({ ok: false, mensaje: "CUIT inválido — debe tener 11 dígitos." }, 400);
  }
  if (!clave) {
    return json({ ok: false, mensaje: "Falta la Clave Fiscal." }, 400);
  }
  if (!acta) {
    return json({ ok: false, mensaje: "Falta el número de acta de vacunación." }, 400);
  }
  if (animales.length === 0) {
    return json({ ok: false, mensaje: "No hay caravanas para declarar." }, 400);
  }

  const resultado = await sincronizarSIGSA({ cuit, clave, acta, loteNombre, animales });
  return json(resultado, resultado.ok ? 200 : 502);
}
