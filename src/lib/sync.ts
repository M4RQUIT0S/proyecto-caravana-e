"use client";

// sincronización con SENASA. Acorde a la exclusión, la API oficial no existe:
// el sistema prepara el paquete y simula el envío con token, deja log/auditoría
// y conserva la cola sin pérdida con reintento.

import { loadDB, uid, update } from "./storage";
import { tokenValido } from "./reglas";
import type { DBShape } from "./types";

export interface RegistroPendiente {
  id: string;
  tipo: "evento" | "documento";
  descripcion: string;
  estado: string;
}

export function registrosPendientes(campoId: string, db: DBShape): RegistroPendiente[] {
  const eventos = db.eventos
    .filter(
      (e) =>
        e.campoId === campoId &&
        e.activo !== false &&
        (e.estadoSincronizacion === "local" ||
          e.estadoSincronizacion === "pendiente" ||
          e.estadoSincronizacion === "rechazado")
    )
    .map((e) => ({
      id: e.id,
      tipo: "evento" as const,
      descripcion:
        e.tipo === "sanitario"
          ? `Sanidad${e.productoNombre ? ` · ${e.productoNombre}` : ""}`
          : e.tipo === "pesaje"
          ? `Pesaje · ${e.pesoKg} kg`
          : `Movimiento ${e.subtipo} · ${e.motivo}`,
      estado: e.estadoSincronizacion,
    }));
  const docs = db.documentos
    .filter((d) => d.campoId === campoId && (d.estado === "preparado" || d.estado === "observado"))
    .map((d) => ({
      id: d.id,
      tipo: "documento" as const,
      descripcion: `DT-e · ${d.cantidadAnimales} animales → ${d.destino ?? ""}`,
      estado: d.estado,
    }));
  return [...docs, ...eventos];
}

export interface ResultadoSync {
  ok: boolean;
  error?: string;
  aceptados: number;
  rechazados: { id: string; descripcion: string; motivo: string }[];
}

// Simula la validación externa de cada registro pendiente.
export function sincronizar(campoId: string, usuarioId: string): ResultadoSync {
  const dbRead = loadDB();
  const campo = dbRead.campos.find((c) => c.id === campoId);
  const token = campo?.tokenSenasa;

  const tk = tokenValido(token);
  if (!tk.ok) return { ok: false, error: tk.error, aceptados: 0, rechazados: [] };

  const pendientes = registrosPendientes(campoId, dbRead);
  if (pendientes.length === 0)
    return { ok: true, aceptados: 0, rechazados: [] };

  // Regla de validación simulada: el establecimiento debe tener RENSPA cargado.
  const faltaRenspa = !campo?.renspa?.trim();

  const rechazados: ResultadoSync["rechazados"] = [];
  let aceptados = 0;

  update((db) => {
    const c = db.campos.find((x) => x.id === campoId);
    const renspaFalta = !c?.renspa?.trim();
    for (const p of pendientes) {
      const motivo = renspaFalta ? "RENSPA del establecimiento no configurado" : null;
      const resultado: "aceptado" | "rechazado" = motivo ? "rechazado" : "aceptado";
      if (motivo) rechazados.push({ id: p.id, descripcion: p.descripcion, motivo });
      else aceptados++;

      if (p.tipo === "evento") {
        const ev = db.eventos.find((e) => e.id === p.id);
        if (ev) ev.estadoSincronizacion = motivo ? "rechazado" : "sincronizado";
      } else {
        const doc = db.documentos.find((d) => d.id === p.id);
        if (doc) doc.estado = motivo ? "observado" : "emitido";
      }

      db.sincronizaciones.push({
        id: uid("sinc_"),
        campoId,
        fechaHora: Date.now(),
        tipoRegistro: p.tipo === "documento" ? "documento" : "evento",
        refId: p.id,
        resultado,
        mensajeRespuesta: motivo ?? "Aceptado por SENASA (simulado)",
        tokenUsado: token,
        usuarioId,
      });
    }
  });

  return {
    ok: true,
    aceptados,
    rechazados,
    error: faltaRenspa
      ? "Configurá el RENSPA del establecimiento en Catálogos para que SENASA acepte los registros."
      : undefined,
  };
}

export function logsDe(campoId: string, db: DBShape, limite = 20) {
  return db.sincronizaciones
    .filter((s) => s.campoId === campoId)
    .sort((a, b) => b.fechaHora - a.fechaHora)
    .slice(0, limite);
}
