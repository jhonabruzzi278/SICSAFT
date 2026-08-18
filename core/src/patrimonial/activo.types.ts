// DOC-005 §4 — estado de Activo. 'mantenimiento'/'inactivo' agregados en Fase 3.1 (2026-08-17,
// migracion 1755400000000) — declarables por cualquier operador de APP QR sin rol
// administrador-patrimonial, ver DOC-012 §5.1.
export type EstadoActivo =
  | 'activo'
  | 'en_transito'
  | 'extraviado'
  | 'mantenimiento'
  | 'inactivo'
  | 'dado_de_baja';

// Subconjunto de EstadoActivo que un operador de APP QR puede declarar via POST /inventarios
// (InventariosService), sin el rol administrador-patrimonial — Tomo III §1.4 se lo concede
// explicitamente a esa entrada ("registro de inventarios/estados"). No incluye en_transito,
// extraviado ni dado_de_baja: esas transiciones siguen su propio camino (Motor Patrimonial /
// Administrador Patrimonial), DOC-012 §5.1.
export type EstadoOperativoDeclarable = 'activo' | 'mantenimiento' | 'inactivo';

export interface CatalogoActivoInfo {
  tipo: string;
  familia: string;
  subfamilia: string | null;
  marca: string | null;
  modelo: string | null;
}

export interface Activo {
  id: string;
  codigoPatrimonial: string;
  codigoQr: string;
  organizacionId: string;
  areaId: string | null;
  ubicacionId: string | null;
  // Ya era columna de la tabla (migracion Fase 1) — sin seleccionar hasta ahora porque ningun
  // consumidor lo necesitaba (GET /catalogo no lo expone, DOC-006 §2). DOC-012 §5/§7 si lo
  // necesita (alta con responsable, cambio de responsable).
  responsableId: string | null;
  estado: EstadoActivo;
  catalogo: CatalogoActivoInfo;
}

// DOC-012 §5 — payload de POST /activos (alta). `organizacionId`/`catalogoId` son las unicas
// referencias obligatorias para que el activo exista de forma minima; el resto se asigna despues
// (traslado/cambio de responsable) o directo acá si ya se conoce.
export interface NuevoActivoInput {
  codigoPatrimonial: string;
  codigoQr: string;
  organizacionId: string;
  catalogoId: string;
  serie?: string;
  responsableId?: string;
  areaId?: string;
  ubicacionId?: string;
  valorPatrimonial?: number;
}

export interface CatalogoFiltro {
  organizacionId: string;
  areaId?: string;
  ubicacionId?: string;
  limit: number;
  offset: number;
}

// Forma que ya espera CIS (cis/src/qr-connector/qr-connector.types.ts, ActivoCatalogo) — DOC-006
// §2. `nombre` no es un campo propio de catalogo_activos, se compone (ver
// construirNombreActivo en activo.repository.ts).
export interface ActivoCatalogo {
  codigoQr: string;
  nombre: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  estado: EstadoActivo;
}

export interface CatalogoPagina {
  activos: ActivoCatalogo[];
  total: number;
}
