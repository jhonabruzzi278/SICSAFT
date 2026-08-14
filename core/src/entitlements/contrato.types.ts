import type { Sede } from './entitlements.types';

// Modelo de base-patrimonial/DOC-004-modelo-contrato.md §2/§3, persistido en Postgres (ver
// devops/local/postgres/init/schema/core.sql y ContratoRepository).

// `vencido` puede venir guardado si algun proceso lo escribe, pero hoy nada lo hace — el
// vencimiento se deriva en runtime comparando fechas (ver EntitlementsService), porque no hay
// cron que actualice la columna `estado`. Solo `vigente`/`suspendido`/`cancelado` son
// transiciones manuales reales acá.
export type EstadoContrato = 'vigente' | 'suspendido' | 'vencido' | 'cancelado';

// Vocabulario controlado de DOC-004 §5 — hoy solo existe un modulo real.
export type ModuloContratado = 'inventario-qr';

export interface Contrato {
  id: string;
  organizacionId: string;
  // Cache de lectura del nombre — Zitadel es la fuente de verdad de la organizacion, ver DOC-004
  // §2 "Organización".
  organizacionNombre: string;
  sedes: Sede[];
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  estado: EstadoContrato;
  modulosContratados: ModuloContratado[];
}

// DOC-012 §7 — POST /contratos (alta). CORE decide `estado` ('vigente') — nunca se confia ese
// campo desde el cliente (mismo criterio que NuevoActivoInput/DOC-012 §5).
export interface NuevoContratoInput {
  organizacionId: string;
  sedeIds: string[];
  vigenciaDesde: string;
  vigenciaHasta?: string | null;
  modulosContratados: ModuloContratado[];
}

// RNF-01 (cierra el gap) — GET /contratos paginado, mismo criterio que CatalogoPagina.
export interface ContratosPagina {
  contratos: Contrato[];
  total: number;
}
