// DOC-005 §4 — estado de Activo. 'en_mantenimiento' deliberadamente fuera (Tomo III §4.15 lo
// marca "modulo futuro").
export type EstadoActivo =
  'activo' | 'en_transito' | 'extraviado' | 'dado_de_baja';

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
  estado: EstadoActivo;
  catalogo: CatalogoActivoInfo;
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
