import { NextResponse } from "next/server";
import { sincronizarSIGSA, type AnimalParaBot } from "@/lib/sigsa-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Cloud Run aguanta sin problemas; en Vercel se ignora si no es Pro

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
    return NextResponse.json({ ok: false, mensaje: "Body inválido (JSON requerido)." }, { status: 400 });
  }

  const cuit = body.cuit?.replace(/\D/g, "") ?? "";
  const clave = body.clave ?? "";
  const acta = body.acta?.trim() ?? "";
  const loteNombre = body.loteNombre?.trim() || "lote";
  const animales = Array.isArray(body.animales) ? body.animales : [];

  if (cuit.length !== 11) {
    return NextResponse.json(
      { ok: false, mensaje: "CUIT inválido — debe tener 11 dígitos." },
      { status: 400 }
    );
  }
  if (!clave) {
    return NextResponse.json({ ok: false, mensaje: "Falta la Clave Fiscal." }, { status: 400 });
  }
  if (!acta) {
    return NextResponse.json(
      { ok: false, mensaje: "Falta el número de acta de vacunación." },
      { status: 400 }
    );
  }
  if (animales.length === 0) {
    return NextResponse.json(
      { ok: false, mensaje: "No hay caravanas para declarar." },
      { status: 400 }
    );
  }

  const resultado = await sincronizarSIGSA({
    cuit,
    clave,
    acta,
    loteNombre,
    animales,
  });

  if (resultado.ok) {
    return NextResponse.json(resultado, { status: 200 });
  }
  return NextResponse.json(resultado, { status: 502 });
}
