"use client";

// reportes productivos y de rentabilidad. Cruza pesajes/ADPV con costos
// imputados (CostoAnimal) para sustentar la decisión de reposición: detecta
// la "cola de tropa" (animales que comen pero no ganan) y hallazgos por proveedor/origen.

import { esActivo, estado } from "./reglas";
import { costoDeAnimal } from "./costos";
import type { Animal, CostoAnimal, DBShape, Evento, Pesaje } from "./types";

export interface FiltrosReporte {
  loteId?: string;
  proveedorId?: string;
  desde?: string; // ISO
  hasta?: string; // ISO
}

export interface FilaRentabilidad {
  animalId: string;
  caravana: string;
  categoria?: string;
  loteNombre?: string;
  proveedor?: string;
  pesoActual?: number;
  kilosGanados: number; // suma de ganancias entre pesajes
  adpv?: number; // último ADPV
  costoTotal: number;
  margen: number; // kilosGanados*valorKg - costoTotal (valorKg orientativo)
  colaDeTropa: boolean;
}

export interface ResumenRentabilidad {
  filas: FilaRentabilidad[];
  adpvPromedio: number | null;
  costoTotal: number;
  kilosTotal: number;
  margenTotal: number;
  colaDeTropa: FilaRentabilidad[];
}

const VALOR_KG_DEFAULT = 1500; // $/kg orientativo para estimar margen (configurable a futuro)
const ADPV_COLA = 0.3; // kg/día: por debajo es "cola de tropa"

export function resumenRentabilidad(
  campoId: string,
  db: DBShape,
  filtros: FiltrosReporte = {},
  valorKg = VALOR_KG_DEFAULT
): ResumenRentabilidad {
  const animales = db.animales.filter(
    (a) =>
      a.campoId === campoId &&
      esActivo(a) &&
      (filtros.loteId ? a.loteId === filtros.loteId : true) &&
      (filtros.proveedorId ? a.proveedorId === filtros.proveedorId : true)
  );

  const animalesPorLote = new Map<string, number>();
  for (const a of db.animales) {
    if (a.campoId === campoId && a.loteId)
      animalesPorLote.set(a.loteId, (animalesPorLote.get(a.loteId) || 0) + 1);
  }

  const costos = db.costos.filter(
    (c) => c.campoId === campoId && dentroDeFecha(c.fecha, filtros)
  );

  const filas: FilaRentabilidad[] = animales.map((a) => {
    const pesajes = pesajesDeAnimal(a.id, db.eventos, filtros).sort(
      (x, y) => x.fechaHora - y.fechaHora
    );
    const kilosGanados = sumarGanancias(pesajes);
    const adpv = pesajes[pesajes.length - 1]?.adpv;
    const costoTotal = costoDeAnimal(a.id, a.loteId, costos, animalesPorLote);
    const margen = Math.round((kilosGanados * valorKg - costoTotal) * 100) / 100;
    const lote = db.lotes.find((l) => l.id === a.loteId);
    const prov = db.proveedores.find((p) => p.id === a.proveedorId);
    return {
      animalId: a.id,
      caravana: a.caravana,
      categoria: a.categoria,
      loteNombre: lote?.nombre,
      proveedor: prov?.razonSocial,
      pesoActual: a.peso,
      kilosGanados: Math.round(kilosGanados * 10) / 10,
      adpv,
      costoTotal,
      margen,
      colaDeTropa: adpv != null && adpv < ADPV_COLA,
    };
  });

  const conAdpv = filas.filter((f) => f.adpv != null);
  const adpvPromedio =
    conAdpv.length > 0
      ? Math.round((conAdpv.reduce((s, f) => s + (f.adpv ?? 0), 0) / conAdpv.length) * 1000) / 1000
      : null;

  return {
    filas,
    adpvPromedio,
    costoTotal: redondear(filas.reduce((s, f) => s + f.costoTotal, 0)),
    kilosTotal: redondear(filas.reduce((s, f) => s + f.kilosGanados, 0)),
    margenTotal: redondear(filas.reduce((s, f) => s + f.margen, 0)),
    colaDeTropa: filas.filter((f) => f.colaDeTropa),
  };
}

export interface HallazgoProveedor {
  proveedorId: string;
  proveedor: string;
  zonaOrigen?: string;
  animales: number;
  muertos: number;
  eventosSanitarios: number;
  adpvPromedio: number | null;
  tasaMortandad: number; // %
}

// Mortandad / morbilidad por proveedor de origen: qué procedencias rinden peor.
export function hallazgosPorProveedor(campoId: string, db: DBShape): HallazgoProveedor[] {
  const proveedores = db.proveedores.filter((p) => p.campoId === campoId);
  return proveedores
    .map((p) => {
      const animales = db.animales.filter((a) => a.campoId === campoId && a.proveedorId === p.id);
      const muertos = animales.filter((a) => estado(a) === "muerto").length;
      const ids = new Set(animales.map((a) => a.id));
      const eventosSanitarios = db.eventos.filter(
        (e) => e.tipo === "sanitario" && e.activo !== false && ids.has(e.animalId)
      ).length;
      const adpvs = animales
        .map((a) => ultimoAdpv(a.id, db.eventos))
        .filter((x): x is number => x != null);
      const adpvPromedio =
        adpvs.length > 0
          ? Math.round((adpvs.reduce((s, x) => s + x, 0) / adpvs.length) * 1000) / 1000
          : null;
      return {
        proveedorId: p.id,
        proveedor: p.razonSocial,
        zonaOrigen: p.zonaOrigen,
        animales: animales.length,
        muertos,
        eventosSanitarios,
        adpvPromedio,
        tasaMortandad: animales.length ? Math.round((muertos / animales.length) * 1000) / 10 : 0,
      };
    })
    .filter((h) => h.animales > 0)
    .sort((a, b) => b.tasaMortandad - a.tasaMortandad);
}

function pesajesDeAnimal(animalId: string, eventos: Evento[], filtros: FiltrosReporte): Pesaje[] {
  return eventos.filter(
    (e): e is Pesaje =>
      e.tipo === "pesaje" &&
      e.animalId === animalId &&
      e.activo !== false &&
      dentroDeFecha(e.fecha, filtros)
  );
}

function ultimoAdpv(animalId: string, eventos: Evento[]): number | undefined {
  const ps = eventos
    .filter((e): e is Pesaje => e.tipo === "pesaje" && e.animalId === animalId && e.activo !== false)
    .sort((a, b) => b.fechaHora - a.fechaHora);
  return ps[0]?.adpv;
}

function sumarGanancias(pesajesOrdenados: Pesaje[]): number {
  let total = 0;
  for (let i = 1; i < pesajesOrdenados.length; i++) {
    const d = pesajesOrdenados[i].pesoKg - pesajesOrdenados[i - 1].pesoKg;
    if (d > 0) total += d;
  }
  return total;
}

function dentroDeFecha(fecha: string | undefined, filtros: FiltrosReporte): boolean {
  if (!fecha) return true;
  if (filtros.desde && fecha < filtros.desde) return false;
  if (filtros.hasta && fecha > filtros.hasta) return false;
  return true;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

export const VALOR_KG_REFERENCIA = VALOR_KG_DEFAULT;
