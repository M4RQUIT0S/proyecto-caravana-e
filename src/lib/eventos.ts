"use client";

// Registro de eventos de trazabilidad (sanidad, pesaje, movimiento) y
// consulta del historial individual. Captura una sola vez en el origen:
// cada registro puede nacer de una LecturaRFID y queda auditado y en cola offline.

import { uid, update } from "./storage";
import {
  aptoParaFaena,
  calcularADPV,
  calcularFinCarencia,
  coherenciaCategoriaSexo,
  diasEntre,
  dosisEnRango,
  estaEnCarencia,
  estado,
  eventoPermitidoEnEstado,
  fechaNoFutura,
  hoyISO,
  pesoFueraDeRango,
  puedeMoverse,
} from "./reglas";
import type {
  Animal,
  CanalCaptura,
  DBShape,
  Evento,
  EventoSanitario,
  Movimiento,
  Pesaje,
  ProductoSanitario,
} from "./types";

export type Resultado = { ok: true; id: string } | { ok: false; error: string };

// ----- Lectura RFID en el origen -----
export function registrarLectura(
  campoId: string,
  caravana: string,
  usuarioId: string,
  canal: CanalCaptura = "manual",
  dispositivo?: string
): string {
  const id = uid("lec_");
  update((db) => {
    db.lecturas.push({
      id,
      campoId,
      caravana,
      usuarioId,
      fechaHora: Date.now(),
      canalCaptura: canal,
      dispositivo,
      sincronizada: false,
    });
  });
  return id;
}

// ----- Evento sanitario -----
export interface InputSanitario {
  campoId: string;
  animalId: string;
  usuarioId: string;
  catalogoId?: string;
  productoId?: string;
  dosis?: number;
  unidadDosis?: string;
  responsable?: string;
  fecha: string; // ISO yyyy-mm-dd
  observacion?: string;
  lecturaId?: string;
  online: boolean;
  animalesAfectados?: string[]; // carga grupal (lote)
}

export function registrarSanitario(
  input: InputSanitario,
  animales: Animal[],
  productos: ProductoSanitario[]
): Resultado {
  const animal = animales.find((a) => a.id === input.animalId);
  if (!animal) return { ok: false, error: "Animal no encontrado." };

  const estadoCheck = eventoPermitidoEnEstado(animal);
  if (!estadoCheck.ok) return { ok: false, error: estadoCheck.error! };

  const fechaCheck = fechaNoFutura(input.fecha);
  if (!fechaCheck.ok) return { ok: false, error: fechaCheck.error! };

  const producto = productos.find((p) => p.id === input.productoId);
  const dosisCheck = dosisEnRango(input.dosis, producto);
  if (!dosisCheck.ok) return { ok: false, error: dosisCheck.error! };

  const dias = producto?.diasCarencia ?? 0;
  const fechaFinCarencia = calcularFinCarencia(input.fecha, dias);

  const id = uid("ev_");
  update((db) => {
    const ev: EventoSanitario = {
      id,
      tipo: "sanitario",
      campoId: input.campoId,
      animalId: input.animalId,
      animalesAfectados: input.animalesAfectados,
      usuarioId: input.usuarioId,
      responsable: input.responsable,
      catalogoId: input.catalogoId,
      lecturaId: input.lecturaId,
      fechaHora: Date.now(),
      fecha: input.fecha,
      observacion: input.observacion,
      estadoSincronizacion: input.online ? "pendiente" : "local",
      activo: true,
      createdAt: Date.now(),
      productoId: input.productoId,
      productoNombre: producto?.nombreComercial,
      dosis: input.dosis,
      unidadDosis: input.unidadDosis ?? producto?.unidadMedida,
      diasCarencia: dias,
      fechaFinCarencia,
    };
    db.eventos.push(ev);
    asociarLectura(db, input.lecturaId, id);
    // Aplicar carencia al/los animales afectados
    const objetivo = input.animalesAfectados?.length
      ? input.animalesAfectados
      : [input.animalId];
    if (fechaFinCarencia) {
      for (const aid of objetivo) {
        const a = db.animales.find((x) => x.id === aid);
        if (a && (a.estado ?? "activo") === "activo") {
          a.estado = "en_carencia";
          a.fechaCarenciaHasta = fechaFinCarencia;
          a.updatedAt = Date.now();
        } else if (a) {
          // si ya tenía carencia, extender a la mayor
          if (!a.fechaCarenciaHasta || a.fechaCarenciaHasta < fechaFinCarencia) {
            a.fechaCarenciaHasta = fechaFinCarencia;
            a.updatedAt = Date.now();
          }
        }
      }
    }
  });
  return { ok: true, id };
}

// ----- Pesaje -----
export interface InputPesaje {
  campoId: string;
  animalId: string;
  usuarioId: string;
  catalogoId?: string;
  pesoKg: number;
  fecha: string;
  observacion?: string;
  lecturaId?: string;
  online: boolean;
  confirmarFueraDeRango?: boolean;
}

export function registrarPesaje(
  input: InputPesaje,
  animales: Animal[],
  eventos: Evento[]
): Resultado {
  const animal = animales.find((a) => a.id === input.animalId);
  if (!animal) return { ok: false, error: "Animal no encontrado." };

  const estadoCheck = eventoPermitidoEnEstado(animal);
  if (!estadoCheck.ok) return { ok: false, error: estadoCheck.error! };

  const fechaCheck = fechaNoFutura(input.fecha);
  if (!fechaCheck.ok) return { ok: false, error: fechaCheck.error! };

  if (!input.pesoKg || input.pesoKg <= 0)
    return { ok: false, error: "El peso debe ser mayor a 0." };

  const fuera = pesoFueraDeRango(input.pesoKg, animal.categoria);
  if (fuera && !input.confirmarFueraDeRango)
    return {
      ok: false,
      error: "FUERA_DE_RANGO", // la UI pide confirmación explícita
    };

  const previo = ultimoPesaje(input.animalId, eventos);
  let pesoAnteriorKg: number | undefined;
  let dias: number | undefined;
  let adpv: number | undefined;
  if (previo && previo.fecha) {
    pesoAnteriorKg = previo.pesoKg;
    dias = diasEntre(previo.fecha, input.fecha);
    adpv = calcularADPV(input.pesoKg, previo.pesoKg, dias ?? 0);
  }

  const id = uid("ev_");
  update((db) => {
    const ev: Pesaje = {
      id,
      tipo: "pesaje",
      campoId: input.campoId,
      animalId: input.animalId,
      usuarioId: input.usuarioId,
      catalogoId: input.catalogoId,
      lecturaId: input.lecturaId,
      fechaHora: Date.now(),
      fecha: input.fecha,
      observacion: input.observacion,
      estadoSincronizacion: input.online ? "pendiente" : "local",
      activo: true,
      createdAt: Date.now(),
      pesoKg: input.pesoKg,
      pesoAnteriorKg,
      diasEntrePesajes: dias,
      adpv,
      fueraDeRango: fuera,
    };
    db.eventos.push(ev);
    asociarLectura(db, input.lecturaId, id);
    const a = db.animales.find((x) => x.id === input.animalId);
    if (a) {
      a.peso = input.pesoKg;
      a.updatedAt = Date.now();
    }
  });
  return { ok: true, id };
}

// ----- Movimiento -----
export interface InputMovimiento {
  campoId: string;
  usuarioId: string;
  subtipo: "interno" | "externo";
  motivo: string;
  loteOrigenId?: string;
  loteDestinoId?: string;
  destinoExterno?: string;
  fecha: string;
  observacion?: string;
  animalIds: string[]; // movimiento grupal
  esProductor: boolean;
  online: boolean;
}

export function registrarMovimiento(
  input: InputMovimiento,
  animales: Animal[]
): Resultado {
  if (input.animalIds.length === 0)
    return { ok: false, error: "Seleccioná al menos un animal." };

  const fechaCheck = fechaNoFutura(input.fecha);
  if (!fechaCheck.ok) return { ok: false, error: fechaCheck.error! };

  // Validar cada animal
  for (const aid of input.animalIds) {
    const a = animales.find((x) => x.id === aid);
    if (!a) return { ok: false, error: "Algún animal no existe." };
    const mov = puedeMoverse(a, input.esProductor);
    if (!mov.ok) return { ok: false, error: `${a.caravana}: ${mov.error}` };
  }

  const esExterno = input.subtipo === "externo";
  const muerte = /muert/i.test(input.motivo);
  const id = uid("ev_");
  update((db) => {
    const ev: Movimiento = {
      id,
      tipo: "movimiento",
      campoId: input.campoId,
      animalId: input.animalIds[0],
      animalesAfectados: input.animalIds,
      usuarioId: input.usuarioId,
      fechaHora: Date.now(),
      fecha: input.fecha,
      observacion: input.observacion,
      estadoSincronizacion: input.online ? "pendiente" : "local",
      activo: true,
      createdAt: Date.now(),
      subtipo: input.subtipo,
      motivo: input.motivo,
      loteOrigenId: input.loteOrigenId,
      loteDestinoId: input.loteDestinoId,
      destinoExterno: input.destinoExterno,
      requiereDTe: esExterno && !muerte,
    };
    db.eventos.push(ev);
    for (const aid of input.animalIds) {
      const a = db.animales.find((x) => x.id === aid);
      if (!a) continue;
      if (input.subtipo === "interno") {
        a.loteId = input.loteDestinoId || undefined;
      } else if (muerte) {
        a.estado = "muerto";
      } else {
        a.estado = "egresado";
      }
      a.updatedAt = Date.now();
    }
  });
  return { ok: true, id };
}

// ----- Consultas -----
export function ultimoPesaje(animalId: string, eventos: Evento[]): Pesaje | undefined {
  const pesajes = eventos
    .filter(
      (e): e is Pesaje =>
        e.tipo === "pesaje" && e.animalId === animalId && e.activo !== false
    )
    .sort((a, b) => b.fechaHora - a.fechaHora);
  return pesajes[0];
}

export interface ItemHistorial {
  id: string;
  fechaHora: number;
  fecha?: string;
  tipo: "alta" | "sanitario" | "pesaje" | "movimiento" | "alerta";
  titulo: string;
  detalle?: string;
  estadoSincronizacion?: string;
}

// historial individual completo y cronológico.
export function historialDeAnimal(animalId: string, db: DBShape): ItemHistorial[] {
  const animal = db.animales.find((a) => a.id === animalId);
  const items: ItemHistorial[] = [];
  if (animal) {
    items.push({
      id: `alta_${animal.id}`,
      fechaHora: animal.createdAt,
      fecha: animal.fechaNacimiento,
      tipo: "alta",
      titulo: "Alta del animal con CII",
      detalle: `${animal.caravana}${animal.categoria ? ` · ${animal.categoria}` : ""}`,
    });
  }
  for (const e of db.eventos) {
    if (e.activo === false) continue;
    const afecta = e.animalId === animalId || e.animalesAfectados?.includes(animalId);
    if (!afecta) continue;
    if (e.tipo === "sanitario") {
      items.push({
        id: e.id,
        fechaHora: e.fechaHora,
        fecha: e.fecha,
        tipo: "sanitario",
        titulo: e.productoNombre ? `Sanidad · ${e.productoNombre}` : "Evento sanitario",
        detalle:
          (e.dosis ? `Dosis ${e.dosis}${e.unidadDosis ?? ""}. ` : "") +
          (e.diasCarencia ? `Carencia ${e.diasCarencia} días (hasta ${e.fechaFinCarencia}).` : "Sin carencia."),
        estadoSincronizacion: e.estadoSincronizacion,
      });
    } else if (e.tipo === "pesaje") {
      items.push({
        id: e.id,
        fechaHora: e.fechaHora,
        fecha: e.fecha,
        tipo: "pesaje",
        titulo: `Pesaje · ${e.pesoKg} kg`,
        detalle:
          e.adpv != null
            ? `ADPV ${e.adpv} kg/día${e.fueraDeRango ? " · fuera de rango" : ""}`
            : e.fueraDeRango
            ? "Fuera de rango"
            : undefined,
        estadoSincronizacion: e.estadoSincronizacion,
      });
    } else if (e.tipo === "movimiento") {
      items.push({
        id: e.id,
        fechaHora: e.fechaHora,
        fecha: e.fecha,
        tipo: "movimiento",
        titulo: `Movimiento ${e.subtipo} · ${e.motivo}`,
        detalle: e.destinoExterno || undefined,
        estadoSincronizacion: e.estadoSincronizacion,
      });
    }
  }
  for (const al of animal?.alertas ?? []) {
    items.push({
      id: al.id,
      fechaHora: al.createdAt,
      fecha: al.fecha,
      tipo: "alerta",
      titulo: `Alerta ${al.tipo} · ${al.titulo}`,
      detalle: al.resuelta ? "Resuelta" : "Activa",
    });
  }
  return items.sort((a, b) => b.fechaHora - a.fechaHora);
}

// Semáforo de aptitud: apto para moverse/faena.
export function aptitud(animal: Animal): {
  color: "verde" | "amber" | "rojo";
  texto: string;
} {
  const e = estado(animal);
  if (e === "muerto" || e === "egresado")
    return { color: "rojo", texto: e === "muerto" ? "Muerto" : "Egresado" };
  if (estaEnCarencia(animal))
    return { color: "rojo", texto: `En carencia hasta ${animal.fechaCarenciaHasta}` };
  if (e === "restringido") return { color: "amber", texto: "Restringido" };
  const apto = aptoParaFaena(animal);
  return apto.ok
    ? { color: "verde", texto: "Apto para movimiento" }
    : { color: "amber", texto: apto.error ?? "Revisar" };
}

// Validación de alta (coherencia categoría/sexo), usada por el modal.
export function validarAltaCoherencia(categoria?: string, sexo?: "M" | "H"): string | null {
  const v = coherenciaCategoriaSexo(categoria, sexo);
  return v.ok ? null : v.error ?? null;
}

function asociarLectura(db: DBShape, lecturaId: string | undefined, eventoId: string) {
  if (!lecturaId) return;
  const lec = db.lecturas.find((l) => l.id === lecturaId);
  if (lec) lec.contextoEventoId = eventoId;
}

export function hoy(): string {
  return hoyISO();
}
