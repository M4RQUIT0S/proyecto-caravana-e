"use client";

// administración de datos maestros (catálogos de eventos, productos sanitarios,
// proveedores y datos del establecimiento). Baja lógica, unicidad de RENSPA.

import { uid, update } from "./storage";
import { colorCaravana, renspaUnico } from "./reglas";
import type {
  CatalogoEvento,
  Proveedor,
  ProductoSanitario,
  TipoEvento,
} from "./types";

// ----- Datos del establecimiento -----
export interface DatosEstablecimiento {
  renspa?: string;
  cuig?: string;
  partido?: string;
  provincia?: string;
  superficieHa?: number;
  zonaVacunacionAftosa?: boolean;
  tokenSenasa?: string;
}

export function guardarEstablecimiento(
  campoId: string,
  datos: DatosEstablecimiento
): { ok: true } | { ok: false; error: string } {
  const db = (() => {
    try {
      return JSON.parse(window.localStorage.getItem("caravanas:v1") || "{}");
    } catch {
      return {};
    }
  })();
  if (datos.renspa?.trim()) {
    const v = renspaUnico(datos.renspa, db.campos ?? [], campoId);
    if (!v.ok) return { ok: false, error: v.error! };
  }
  update((db) => {
    const c = db.campos.find((x) => x.id === campoId);
    if (!c) return;
    c.renspa = datos.renspa?.trim() || undefined;
    c.cuig = datos.cuig?.trim() || undefined;
    c.partido = datos.partido?.trim() || undefined;
    c.provincia = datos.provincia?.trim() || undefined;
    c.superficieHa = datos.superficieHa;
    c.zonaVacunacionAftosa = datos.zonaVacunacionAftosa;
    c.tokenSenasa = datos.tokenSenasa?.trim() || undefined;
  });
  return { ok: true };
}

export function colorOficial(zonaVacunacionAftosa?: boolean): string {
  return colorCaravana({ zonaVacunacionAftosa });
}

// ----- Catálogo de eventos -----
export function crearCatalogo(
  campoId: string,
  datos: { tipoEvento: TipoEvento; codigo: string; descripcion: string; requiereProducto?: boolean }
): void {
  update((db) => {
    db.catalogos.push({
      id: uid("cat_"),
      campoId,
      tipoEvento: datos.tipoEvento,
      codigo: datos.codigo.trim(),
      descripcion: datos.descripcion.trim(),
      requiereProducto: datos.requiereProducto ?? false,
      activo: true,
      createdAt: Date.now(),
    });
  });
}

export function editarCatalogo(id: string, datos: Partial<CatalogoEvento>): void {
  update((db) => {
    const c = db.catalogos.find((x) => x.id === id);
    if (c) Object.assign(c, datos);
  });
}

export function desactivarCatalogo(id: string): void {
  update((db) => {
    const c = db.catalogos.find((x) => x.id === id);
    if (c) c.activo = false;
  });
}

export function catalogosDe(
  campoId: string,
  catalogos: CatalogoEvento[],
  tipo?: TipoEvento
): CatalogoEvento[] {
  return catalogos.filter(
    (c) =>
      c.campoId === campoId &&
      c.activo !== false &&
      (tipo ? c.tipoEvento === tipo : true)
  );
}

// ----- Productos sanitarios -----
export function crearProducto(
  campoId: string,
  datos: Omit<ProductoSanitario, "id" | "campoId" | "createdAt" | "activo">
): void {
  update((db) => {
    db.productos.push({
      id: uid("prod_"),
      campoId,
      activo: true,
      createdAt: Date.now(),
      ...datos,
      nombreComercial: datos.nombreComercial.trim(),
    });
  });
}

export function editarProducto(id: string, datos: Partial<ProductoSanitario>): void {
  update((db) => {
    const p = db.productos.find((x) => x.id === id);
    if (p) Object.assign(p, datos);
  });
}

export function desactivarProducto(id: string): void {
  update((db) => {
    const p = db.productos.find((x) => x.id === id);
    if (p) p.activo = false;
  });
}

export function productosDe(
  campoId: string,
  productos: ProductoSanitario[]
): ProductoSanitario[] {
  return productos.filter((p) => p.campoId === campoId && p.activo !== false);
}

// ----- Proveedores -----
export function crearProveedor(
  campoId: string,
  datos: Omit<Proveedor, "id" | "campoId" | "createdAt" | "activo">
): void {
  update((db) => {
    db.proveedores.push({
      id: uid("prov_"),
      campoId,
      activo: true,
      createdAt: Date.now(),
      ...datos,
      razonSocial: datos.razonSocial.trim(),
    });
  });
}

export function editarProveedor(id: string, datos: Partial<Proveedor>): void {
  update((db) => {
    const p = db.proveedores.find((x) => x.id === id);
    if (p) Object.assign(p, datos);
  });
}

export function desactivarProveedor(id: string): void {
  update((db) => {
    const p = db.proveedores.find((x) => x.id === id);
    if (p) p.activo = false;
  });
}

export function proveedoresDe(campoId: string, proveedores: Proveedor[]): Proveedor[] {
  return proveedores.filter((p) => p.campoId === campoId && p.activo !== false);
}
