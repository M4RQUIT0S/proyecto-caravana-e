export type Rol = "admin" | "operador" | "usuario" | "vista";

// Permisos granulares del Operador delegado (RN21 / RF-11 / RF-12).
// Lo que NO está acá queda denegado al delegado: costos, reportes, SENASA y administración.
export interface PermisosOperador {
  capturar: boolean; // captura RFID en manga (CU-02)
  sanidad: boolean; // registrar eventos sanitarios (CU-03)
  pesaje: boolean; // registrar pesajes (CU-04)
  movimiento: boolean; // registrar movimientos internos (CU-06)
}

export interface Usuario {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

export interface MiembroCampo {
  userId: string;
  rol: Rol;
  permisos?: PermisosOperador; // sólo para rol "operador"
  activo?: boolean; // baja lógica (RN07); undefined = activo
  addedAt: number;
}

export interface Campo {
  id: string;
  nombre: string;
  descripcion?: string;
  codigo: string; // código de acceso por invitación
  ownerId: string;
  miembros: MiembroCampo[];
  afip?: AfipCredenciales; // credenciales para el bot SIGSA (sólo localStorage)
  // Datos del establecimiento (DER: Establecimiento)
  renspa?: string; // identificación ante SENASA (RN16, unicidad)
  cuig?: string; // Código Único de Identificación Ganadera
  partido?: string;
  provincia?: string;
  superficieHa?: number;
  zonaVacunacionAftosa?: boolean; // deriva el color oficial de caravana (RN04)
  tokenSenasa?: string; // token de sincronización simulada (RN15)
  createdAt: number;
}

export interface Lote {
  id: string;
  campoId: string;
  nombre: string;
  categoria: string; // ej: "Vacas", "Vaquillonas", "Terneros"
  raza: string; // ej: "Angus", "Hereford"
  tipo?: "potrero" | "corral";
  descripcion?: string;
  activo?: boolean; // baja lógica (RN07)
  createdAt: number;
}

export interface Alerta {
  id: string;
  tipo: "sanitaria" | "reproductiva" | "nutricional" | "otra";
  titulo: string;
  descripcion?: string;
  fecha?: string; // ISO yyyy-mm-dd
  creadaPor: string;
  createdAt: number;
  resuelta?: boolean;
}

export interface DeclaracionSigsa {
  declaradoAt: number;
  declaradoPor: string; // userId
  acta?: string; // número de acta de vacunación
}

export interface AfipCredenciales {
  cuit: string; // sólo dígitos (11)
  clave: string;
  guardadoAt: number;
}

// Estado del animal como máquina de estados (RN14).
export type EstadoAnimal =
  | "activo"
  | "en_carencia"
  | "restringido"
  | "egresado"
  | "muerto";

export type CanalCaptura = "bluetooth" | "usb" | "csv" | "manual";

export interface Animal {
  id: string;
  campoId: string;
  loteId?: string;
  caravana: string; // CII / ID RFID (10 dígitos, RN01)
  nombre?: string;
  sexo?: "M" | "H";
  fechaNacimiento?: string;
  raza?: string; // biotipo / raza
  categoria?: string;
  peso?: number;
  observaciones?: string;
  // Trazabilidad individual (DER: Animal + CaravanaRFID)
  estado?: EstadoAnimal; // undefined = "activo" (RN14)
  fechaCarenciaHasta?: string; // ISO yyyy-mm-dd, fin de carencia vigente (RN03)
  proveedorId?: string; // origen comercial (reportes RU07)
  colorCaravana?: string; // color oficial derivado de la zona (RN04)
  canalCaptura?: CanalCaptura;
  activo?: boolean; // baja lógica (RN07); undefined = activo
  alertas: Alerta[];
  sigsa?: DeclaracionSigsa;
  createdAt: number;
  updatedAt: number;
}

export interface Invitacion {
  id: string;
  campoId: string;
  email: string;
  rol: Rol;
  invitadoPor: string;
  estado: "pendiente" | "aceptada" | "rechazada";
  createdAt: number;
}

// ----- Catálogos y soporte (DER) -----

export type TipoEvento = "sanitario" | "pesaje" | "movimiento";

// CatalogoEvento: tipos normalizados de evento (RN12, sin texto libre).
export interface CatalogoEvento {
  id: string;
  campoId: string;
  tipoEvento: TipoEvento;
  codigo: string;
  descripcion: string;
  requiereProducto?: boolean; // exige producto sanitario
  activo?: boolean; // baja lógica (RN07)
  createdAt: number;
}

// ProductoSanitario: producto veterinario con su período de carencia (RN03).
export interface ProductoSanitario {
  id: string;
  campoId: string;
  nombreComercial: string;
  principioActivo?: string;
  diasCarencia: number; // alimenta el cálculo de carencia
  unidadMedida?: string; // ml, cc, mg…
  dosisMin?: number; // rango de dosis (RN20)
  dosisMax?: number;
  proveedorId?: string;
  activo?: boolean;
  createdAt: number;
}

// Proveedor: origen comercial de hacienda / productos (RU07).
export interface Proveedor {
  id: string;
  campoId: string;
  razonSocial: string;
  cuit?: string;
  tipoProveedor?: "hacienda" | "sanitario" | "dispositivos" | "otro";
  zonaOrigen?: string; // para análisis por procedencia
  activo?: boolean;
  createdAt: number;
}

// LecturaRFID: punto de captura en el origen (RN22 / RNF-01).
export interface LecturaRFID {
  id: string;
  campoId: string;
  caravana: string; // CII leído
  usuarioId: string;
  fechaHora: number;
  dispositivo?: string;
  canalCaptura: CanalCaptura;
  latitud?: number;
  longitud?: number;
  sincronizada?: boolean;
  contextoEventoId?: string; // evento al que se asoció (RN22)
}

export type EstadoSincronizacion =
  | "local"
  | "pendiente"
  | "sincronizado"
  | "observado"
  | "rechazado";

export type ViaAplicacion =
  | "subcutanea"
  | "intramuscular"
  | "oral"
  | "intravenosa"
  | "topica"
  | "otra";

// EventoTrazabilidad (supertipo) + discriminador `tipo` para los subtipos.
interface EventoBase {
  id: string;
  campoId: string;
  animalId: string; // animal protagonista
  animalesAfectados?: string[]; // carga grupal N:M (vacunación / movimiento de lote)
  usuarioId: string; // responsable (auditoría RN10)
  responsable?: string; // ejecutor físico, p.ej. veterinario (dato, no usuario)
  catalogoId?: string; // tipificación desde catálogo (RN12)
  lecturaId?: string; // lectura RFID que lo originó (opcional)
  fechaHora: number;
  fecha?: string; // ISO yyyy-mm-dd del hecho
  observacion?: string;
  estadoSincronizacion: EstadoSincronizacion;
  activo?: boolean; // baja lógica (RN07)
  createdAt: number;
}

export interface EventoSanitario extends EventoBase {
  tipo: "sanitario";
  productoId?: string;
  productoNombre?: string;
  dosis?: number;
  unidadDosis?: string;
  viaAplicacion?: ViaAplicacion;
  diasCarencia: number;
  fechaFinCarencia?: string; // ISO yyyy-mm-dd (RN03)
}

export interface Pesaje extends EventoBase {
  tipo: "pesaje";
  pesoKg: number;
  pesoAnteriorKg?: number;
  diasEntrePesajes?: number;
  adpv?: number; // ganancia diaria de peso vivo (RN13)
  fueraDeRango?: boolean; // RN08
}

export type SubtipoMovimiento = "interno" | "externo";

export interface Movimiento extends EventoBase {
  tipo: "movimiento";
  subtipo: SubtipoMovimiento;
  motivo: string; // cambio de potrero, venta, compra, traslado, muerte…
  loteOrigenId?: string;
  loteDestinoId?: string;
  destinoExterno?: string;
  requiereDTe?: boolean; // movimiento externo exige documentación (RN06)
  documentoId?: string;
}

export type Evento = EventoSanitario | Pesaje | Movimiento;

// DocumentoTransito: DT-e u otro respaldo de movimiento externo (RN06).
export interface DocumentoTransito {
  id: string;
  campoId: string;
  numeroDTe?: string;
  tipoDocumento?: string; // DT-e, guía…
  fechaEmision: number;
  origen?: string;
  destino?: string;
  cantidadAnimales: number;
  animalIds: string[];
  movimientoId?: string;
  estado: "borrador" | "preparado" | "observado" | "emitido";
  createdAt: number;
}

// SincronizacionSENASA: resultado de cada envío/validación (RN15 / RNF-04).
export interface SincronizacionSENASA {
  id: string;
  campoId: string;
  fechaHora: number;
  tipoRegistro: "evento" | "documento" | "alta" | "movimiento";
  refId: string; // id del evento o documento declarado
  resultado: "aceptado" | "observado" | "rechazado";
  mensajeRespuesta?: string;
  tokenUsado?: string;
  usuarioId: string;
}

export type TipoCosto =
  | "alimentacion"
  | "sanidad"
  | "mano_obra"
  | "reposicion"
  | "otro";

// CostoAnimal: costos imputados para análisis de rentabilidad (RU07).
export interface CostoAnimal {
  id: string;
  campoId: string;
  animalId?: string; // costo por animal
  loteId?: string; // o por lote
  tipoCosto: TipoCosto;
  monto: number;
  moneda?: string; // ARS por defecto
  fecha?: string; // ISO yyyy-mm-dd
  descripcion?: string;
  proveedorId?: string;
  createdAt: number;
}

export interface DBShape {
  usuarios: Usuario[];
  campos: Campo[];
  lotes: Lote[];
  animales: Animal[];
  invitaciones: Invitacion[];
  catalogos: CatalogoEvento[];
  productos: ProductoSanitario[];
  proveedores: Proveedor[];
  lecturas: LecturaRFID[];
  eventos: Evento[];
  documentos: DocumentoTransito[];
  sincronizaciones: SincronizacionSENASA[];
  costos: CostoAnimal[];
  sesion: { userId: string | null };
}
