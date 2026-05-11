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
