// Autorización por rol (RNF-05) y límites del Operador delegado (RN21).
// Mapa de roles del SRS sobre los roles de la app:
//   admin    = Productor (acceso total)
//   operador = Operador delegado (subconjunto acotado: captura/sanidad/pesaje/movimiento)
//   usuario  = rol operativo heredado (compat: opera y ve reportes, no administra)
//   vista    = sólo lectura

import type { MiembroCampo, PermisosOperador, Rol } from "./types";

export type Accion =
  | "ver"
  | "alta" // CU-01
  | "capturar" // CU-02
  | "sanidad" // CU-03
  | "pesaje" // CU-04
  | "movimiento" // CU-06
  | "documentacion" // CU-07 (DT-e)
  | "senasa" // CU-08
  | "reportes" // CU-09
  | "costos"
  | "catalogos" // CU-10
  | "admin"; // administrar usuarios/permisos

export const PERMISOS_OPERADOR_DEFAULT: PermisosOperador = {
  capturar: true,
  sanidad: true,
  pesaje: true,
  movimiento: false,
};

// Acciones explícitamente denegadas al Operador delegado (RN21 / RU09).
const DENEGADAS_OPERADOR: Accion[] = [
  "costos",
  "reportes",
  "senasa",
  "documentacion",
  "catalogos",
  "admin",
];

export function puede(
  rol: Rol | null | undefined,
  accion: Accion,
  permisos?: PermisosOperador
): boolean {
  if (!rol) return false;
  if (rol === "vista") return accion === "ver";
  if (rol === "admin") return true; // Productor

  if (rol === "operador") {
    if (DENEGADAS_OPERADOR.includes(accion)) return false;
    const p = permisos ?? PERMISOS_OPERADOR_DEFAULT;
    switch (accion) {
      case "ver":
        return true;
      case "alta":
      case "capturar":
        return p.capturar;
      case "sanidad":
        return p.sanidad;
      case "pesaje":
        return p.pesaje;
      case "movimiento":
        return p.movimiento;
      default:
        return false;
    }
  }

  // rol "usuario" (heredado): opera y consulta, pero no administra ni configura.
  if (rol === "usuario") return accion !== "admin" && accion !== "catalogos";

  return false;
}

export function esProductor(rol: Rol | null | undefined): boolean {
  return rol === "admin";
}

export function permisosDe(miembro: MiembroCampo | undefined): PermisosOperador {
  return miembro?.permisos ?? PERMISOS_OPERADOR_DEFAULT;
}

export const ROL_LABEL: Record<Rol, string> = {
  admin: "Productor",
  operador: "Operador delegado",
  usuario: "Usuario",
  vista: "Sólo lectura",
};
