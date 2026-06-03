// Reglas de negocio del SRS (RN01..RN23). Funciones puras, sin React ni storage,
// para poder reutilizarlas desde formularios y tests. Cada función documenta la regla
// que materializa y su acción ante violación (bloqueo / alerta / cómputo / derivación).

import type {
  Animal,
  Campo,
  EstadoAnimal,
  EstadoSincronizacion,
  Evento,
  ProductoSanitario,
} from "./types";

export interface Validacion {
  ok: boolean;
  error?: string;
}

const OK: Validacion = { ok: true };
const fail = (error: string): Validacion => ({ ok: false, error });

// ---------- RN01: Formato y validación del CII ----------
// Secuencia numérica de exactamente 10 dígitos, sin letras, espacios ni símbolos.
// Acción: bloqueo duro.
export function validarFormatoCII(cii: string): Validacion {
  const v = (cii ?? "").trim();
  if (!v) return fail("El CII es obligatorio.");
  if (!/^\d{10}$/.test(v))
    return fail("El CII debe tener exactamente 10 dígitos numéricos (formato SENASA).");
  return OK;
}

export function ciiValido(cii: string): boolean {
  return validarFormatoCII(cii).ok;
}

// ---------- RN02: No-duplicidad de caravana activa ----------
// Un mismo CII no puede estar asociado a dos animales activos a la vez. Bloqueo duro.
export function caravanaUnicaActiva(
  cii: string,
  campoId: string,
  animales: Animal[],
  excluirAnimalId?: string
): Validacion {
  const dup = animales.find(
    (a) =>
      a.campoId === campoId &&
      a.caravana === cii &&
      a.id !== excluirAnimalId &&
      esActivo(a)
  );
  if (dup) return fail("Ya existe un animal activo con esa caravana (CII duplicado).");
  return OK;
}

// ---------- RN03: Período de carencia ----------
// Cómputo: fechaFinCarencia = fecha del evento + díasCarencia del producto.
export function calcularFinCarencia(
  fechaEventoISO: string,
  diasCarencia: number
): string | undefined {
  if (!diasCarencia || diasCarencia <= 0) return undefined;
  const base = parseISO(fechaEventoISO);
  if (!base) return undefined;
  base.setDate(base.getDate() + diasCarencia);
  return toISO(base);
}

// ¿El animal está en carencia hoy? (fecha actual anterior a fechaCarenciaHasta)
export function estaEnCarencia(animal: Animal, hoy = new Date()): boolean {
  if (!animal.fechaCarenciaHasta) return false;
  const fin = parseISO(animal.fechaCarenciaHasta);
  if (!fin) return false;
  return startOfDay(hoy).getTime() <= startOfDay(fin).getTime();
}

export function diasRestantesCarencia(animal: Animal, hoy = new Date()): number {
  if (!animal.fechaCarenciaHasta) return 0;
  const fin = parseISO(animal.fechaCarenciaHasta);
  if (!fin) return 0;
  const ms = startOfDay(fin).getTime() - startOfDay(hoy).getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
}

// ---------- RN04: Color oficial de caravana según estatus de la zona ----------
// Derivación: zona con vacunación antiaftosa → blanco; sin vacunación → verde.
export function colorCaravana(campo: Pick<Campo, "zonaVacunacionAftosa">): string {
  return campo.zonaVacunacionAftosa ? "blanco" : "verde";
}

// ---------- RN05: Identificación obligatoria temprana ----------
// La fecha de colocación/alta no puede ser anterior al nacimiento. Validación.
export function identificacionTemprana(
  fechaNacimientoISO?: string,
  fechaAltaISO?: string
): Validacion {
  if (!fechaNacimientoISO || !fechaAltaISO) return OK;
  const nac = parseISO(fechaNacimientoISO);
  const alta = parseISO(fechaAltaISO);
  if (nac && alta && alta.getTime() < nac.getTime())
    return fail("La fecha de alta no puede ser anterior a la de nacimiento.");
  return OK;
}

// ---------- RN06: Documentación obligatoria para movimiento externo ----------
// Todo movimiento externo exige datos obligatorios del DT-e. Bloqueo duro.
export function datosDTeObligatorios(datos: {
  origen?: string;
  destino?: string;
  cantidadAnimales: number;
}): Validacion {
  if (!datos.origen?.trim()) return fail("Falta el origen del movimiento.");
  if (!datos.destino?.trim()) return fail("Falta el destino del movimiento.");
  if (!datos.cantidadAnimales || datos.cantidadAnimales <= 0)
    return fail("El DT-e debe incluir al menos un animal.");
  return OK;
}

// ---------- RN07: Baja lógica, no física ----------
export function esActivo(e: { activo?: boolean }): boolean {
  return e.activo !== false;
}

// ---------- RN08: Rango válido de peso por categoría ----------
// Validación con alerta+confirmación (no bloqueo). Rangos orientativos por categoría.
const RANGOS_PESO: Record<string, [number, number]> = {
  ternero: [25, 250],
  ternera: [25, 240],
  novillo: [180, 650],
  novillito: [160, 480],
  vaquillona: [160, 480],
  vaca: [300, 750],
  toro: [400, 1100],
};

export function rangoPesoCategoria(categoria?: string): [number, number] | null {
  if (!categoria) return null;
  const key = categoria
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const [k, rango] of Object.entries(RANGOS_PESO)) {
    if (key.includes(k)) return rango;
  }
  return null;
}

export function pesoFueraDeRango(pesoKg: number, categoria?: string): boolean {
  if (pesoKg <= 0 || pesoKg > 1500) return true; // imposible físico (dominio)
  const rango = rangoPesoCategoria(categoria);
  if (!rango) return false;
  return pesoKg < rango[0] || pesoKg > rango[1];
}

// ---------- RN09 + RN03: Restricción para mover ----------
// Un animal en carencia o restringido no puede moverse sin autorización del Productor.
export function puedeMoverse(
  animal: Animal,
  esProductor: boolean,
  hoy = new Date()
): Validacion {
  if (estado(animal) === "muerto" || estado(animal) === "egresado")
    return fail("El animal ya egresó o está muerto: no admite movimientos (RN18).");
  if (estaEnCarencia(animal, hoy) && !esProductor)
    return fail(
      `Animal en carencia hasta ${animal.fechaCarenciaHasta}. Requiere autorización del Productor.`
    );
  if (estado(animal) === "restringido" && !esProductor)
    return fail("Animal con restricción sanitaria. Requiere autorización del Productor.");
  return OK;
}

// Apto para faena/movimiento externo: bloqueo duro si está en carencia (RN03 / RF-13).
export function aptoParaFaena(animal: Animal, hoy = new Date()): Validacion {
  if (estaEnCarencia(animal, hoy))
    return fail(`En carencia hasta ${animal.fechaCarenciaHasta}`);
  if (estado(animal) === "muerto" || estado(animal) === "egresado")
    return fail("El animal ya egresó o está muerto.");
  return OK;
}

// ---------- RN13: Cálculo de ADPV entre pesajes consecutivos ----------
export function calcularADPV(
  pesoActual: number,
  pesoAnterior: number,
  diasEntre: number
): number | undefined {
  if (!diasEntre || diasEntre <= 0) return undefined;
  return redondear((pesoActual - pesoAnterior) / diasEntre, 3);
}

export function diasEntre(fechaAnteriorISO: string, fechaActualISO: string): number {
  const a = parseISO(fechaAnteriorISO);
  const b = parseISO(fechaActualISO);
  if (!a || !b) return 0;
  return Math.max(
    0,
    Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000)
  );
}

// ---------- RN14: Estados del animal y transiciones ----------
export function estado(animal: Animal): EstadoAnimal {
  return animal.estado ?? "activo";
}

const TRANSICIONES: Record<EstadoAnimal, EstadoAnimal[]> = {
  activo: ["en_carencia", "restringido", "egresado", "muerto"],
  en_carencia: ["activo", "restringido", "muerto"],
  restringido: ["activo", "en_carencia", "egresado", "muerto"],
  egresado: [],
  muerto: [],
};

export function transicionEstadoValida(
  desde: EstadoAnimal,
  hacia: EstadoAnimal
): boolean {
  if (desde === hacia) return true;
  return TRANSICIONES[desde]?.includes(hacia) ?? false;
}

// ---------- RN15: Sincronización requiere credencial válida ----------
export function tokenValido(token?: string): Validacion {
  if (!token?.trim())
    return fail("Falta el token SENASA. Cargalo en los datos del establecimiento.");
  if (token.trim().length < 6) return fail("El token SENASA es inválido (muy corto).");
  return OK;
}

// ---------- RN16: Unicidad de RENSPA ----------
export function renspaUnico(
  renspa: string,
  campos: Campo[],
  excluirCampoId?: string
): Validacion {
  const v = renspa.trim();
  if (!v) return OK;
  const dup = campos.find((c) => c.renspa?.trim() === v && c.id !== excluirCampoId);
  if (dup) return fail("Ya existe un establecimiento con ese RENSPA.");
  return OK;
}

// ---------- RN17: Fechas no futuras y coherencia temporal ----------
export function fechaNoFutura(fechaISO?: string, hoy = new Date()): Validacion {
  if (!fechaISO) return OK;
  const f = parseISO(fechaISO);
  if (f && startOfDay(f).getTime() > startOfDay(hoy).getTime())
    return fail("La fecha no puede ser futura.");
  return OK;
}

// ---------- RN18: Un animal egresado o muerto no admite eventos posteriores ----------
export function eventoPermitidoEnEstado(animal: Animal): Validacion {
  const e = estado(animal);
  if (e === "muerto" || e === "egresado")
    return fail(`El animal está ${e}: no admite nuevos eventos (RN18).`);
  return OK;
}

// ---------- RN19: Coherencia categoría / sexo / edad ----------
export function coherenciaCategoriaSexo(
  categoria?: string,
  sexo?: "M" | "H"
): Validacion {
  if (!categoria || !sexo) return OK;
  const c = categoria.toLowerCase();
  const hembras = ["vaca", "vaquillona", "ternera"];
  const machos = ["toro", "novillo", "novillito", "torito"];
  if (sexo === "M" && hembras.some((h) => c.includes(h)))
    return fail(`Categoría "${categoria}" es de hembra pero el sexo es macho.`);
  if (sexo === "H" && machos.some((m) => c.includes(m)))
    return fail(`Categoría "${categoria}" es de macho pero el sexo es hembra.`);
  return OK;
}

// ---------- RN20: Dosis dentro del rango del producto ----------
export function dosisEnRango(
  dosis: number | undefined,
  producto?: Pick<ProductoSanitario, "dosisMin" | "dosisMax">
): Validacion {
  if (dosis == null || !producto) return OK;
  if (producto.dosisMin != null && dosis < producto.dosisMin)
    return fail(`Dosis por debajo del mínimo (${producto.dosisMin}).`);
  if (producto.dosisMax != null && dosis > producto.dosisMax)
    return fail(`Dosis por encima del máximo (${producto.dosisMax}).`);
  return OK;
}

// ---------- RN22: La lectura RFID debe asociarse a un contexto ----------
export function lecturaConContexto(contextoEventoId?: string): Validacion {
  if (!contextoEventoId)
    return fail("La lectura RFID debe asociarse a un alta, evento, pesaje o movimiento.");
  return OK;
}

// ---------- RN23: Integridad de la sincronización offline ----------
// Un registro local/pendiente nunca se descarta: sólo cambia de estado al sincronizar.
export function esPendienteSync(e: { estadoSincronizacion: EstadoSincronizacion }): boolean {
  return e.estadoSincronizacion === "local" || e.estadoSincronizacion === "pendiente";
}

export function contarPendientes(eventos: Evento[]): number {
  return eventos.filter((e) => esActivo(e) && esPendienteSync(e)).length;
}

// ---------- helpers de fecha ----------
function parseISO(iso?: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function redondear(n: number, dec: number): number {
  const f = 10 ** dec;
  return Math.round(n * f) / f;
}

export function hoyISO(): string {
  return toISO(new Date());
}
