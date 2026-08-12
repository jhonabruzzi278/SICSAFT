export interface Sede {
  id: string;
  nombre: string;
}

export interface Organizacion {
  id: string;
  nombre: string;
  // Sedes cubiertas por contrato vigente — ver ADR-002 (Organizacion -> Contrato -> Sede).
  // El mock no modela "Contrato" todavia como entidad propia, solo su resultado (que sedes
  // quedan habilitadas), para no adelantarse al diseño real que se hace junto con core/ y
  // base-patrimonial/.
  sedes: Sede[];
}

export interface AuthSessionResponse {
  accessToken: string;
  expiresAt: string;
  organizaciones: Organizacion[];
}

export interface ActivoCatalogo {
  codigoQr: string;
  nombre: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  estado: string;
}

export interface CatalogoResponse {
  activos: ActivoCatalogo[];
}

export type InventarioEstado = 'pendiente' | 'recibido' | 'rechazado';

export interface InventarioError {
  campo: string;
  detalle: string;
}

export interface PostInventarioResponse {
  inventarioId: string;
  estado: InventarioEstado;
  errores?: InventarioError[];
}

export interface InventarioEstadoResponse {
  estado: InventarioEstado;
  ultimoIntento: string;
}
