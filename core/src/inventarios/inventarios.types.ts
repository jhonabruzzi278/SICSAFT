import type { ScanResultado } from '../reglas/reglas.types';

// DOC-006 §3 — mismo shape que InventarioRequest de CIS
// (cis/src/qr-connector/qr-connector.schemas.ts). El `resultado` de cada escaneo es la
// clasificacion offline del cliente (sugerencia, no la verdad — ver DOC-006 §3); CORE la
// recalcula con clasificarEscaneo (DOC-009) y esa es la que se persiste.
export interface EscaneoInput {
  codigoQr: string;
  resultado: ScanResultado;
}

export interface IncidenciaInput {
  codigoQr: string;
  descripcion: string;
}

export interface InventarioRequest {
  correlationId: string;
  idempotencyKey: string;
  operadorId: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  fechaInicio: string;
  fechaCierre: string;
  escaneos: EscaneoInput[];
  incidencias: IncidenciaInput[];
}

export interface InventarioError {
  campo: string;
  detalle: string;
}

export type SesionEstado = 'pendiente' | 'recibido' | 'rechazado';

export interface PostInventarioResponse {
  inventarioId: string;
  estado: SesionEstado;
  errores?: InventarioError[];
}

export interface InventarioEstadoResponse {
  estado: SesionEstado;
  ultimoIntento: string;
}

export type {
  SesionResumen,
  SesionDetalle,
} from './sesion-inventario.repository';
