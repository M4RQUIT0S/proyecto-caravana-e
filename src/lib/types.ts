export type Rol = "admin" | "usuario" | "vista";

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
  createdAt: number;
}

export interface Lote {
  id: string;
  campoId: string;
  nombre: string;
  categoria: string; // ej: "Vacas", "Vaquillonas", "Terneros"
  raza: string; // ej: "Angus", "Hereford"
  descripcion?: string;
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

export interface Animal {
  id: string;
  campoId: string;
  loteId?: string;
  caravana: string; // ID RFID / número de caravana
  nombre?: string;
  sexo?: "M" | "H";
  fechaNacimiento?: string;
  raza?: string;
  categoria?: string;
  peso?: number;
  observaciones?: string;
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

export interface DBShape {
  usuarios: Usuario[];
  campos: Campo[];
  lotes: Lote[];
  animales: Animal[];
  invitaciones: Invitacion[];
  sesion: { userId: string | null };
}
