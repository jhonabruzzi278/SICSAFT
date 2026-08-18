import type { ScanResultado } from '../reglas/reglas.types';
import type { EstadoOperativoDeclarable } from '../patrimonial/activo.types';

// DOC-006 §3 — mismo shape que InventarioRequest de CIS
// (cis/src/qr-connector/qr-connector.schemas.ts). El `resultado` de cada escaneo es la
// clasificacion offline del cliente (sugerencia, no la verdad — ver DOC-006 §3); CORE la
// recalcula con clasificarEscaneo (DOC-009) y esa es la que se persiste.
//
// `estadoDeclarado`/`bajaSugerida` — Fase 3.1/DOC-017, DOC-012 §5.1: ambos opcionales, ambos
// aplicables sin el rol administrador-patrimonial (Tomo III §1.4). `estadoDeclarado` dispara una
// transicion real de `Activo.estado` (best-effort — si el activo no existe o esta en un estado
// de origen incompatible, se ignora en silencio, no aborta la sesion completa). `bajaSugerida` es
// puramente informativo: nunca toca `Activo.estado`, solo registra un evento para que el
// Administrador Patrimonial lo revise y decida.
export interface EscaneoInput {
  codigoQr: string;
  resultado: ScanResultado;
  estadoDeclarado?: EstadoOperativoDeclarable;
  bajaSugerida?: { motivo: string };
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
