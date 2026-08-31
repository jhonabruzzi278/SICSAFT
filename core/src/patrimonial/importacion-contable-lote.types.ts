// DOC-029 RF-B — bandeja de staging de la ingesta de Excel supervisada. Un lote pasa por
// `pendiente_revision` -> `aprobado` | `rechazado`; solo al aprobar se ejecuta la importación real
// (ImportacionContableService.procesar) contra la Base Patrimonial.

export type EstadoLote = 'pendiente_revision' | 'aprobado' | 'rechazado';
export type OrigenLote = 'carpeta' | 'manual';

// Mismos valores que ResultadoFila (importacion-contable.types) — la importación no actualiza
// activos existentes, solo los crea; una fila ya presente con distinto contenido es `conflicto`.
export type DryRunFila = 'crear' | 'ya_importado' | 'conflicto';

export interface ResumenLote {
  totalFilas: number;
  crear: number;
  yaImportado: number;
  conflicto: number;
}

export interface LoteImportacionContable {
  id: string;
  organizacionId: string;
  origen: OrigenLote;
  archivoNombre: string | null;
  recibidoEn: string;
  estado: EstadoLote;
  revisadoPor: string | null;
  revisadoEn: string | null;
  motivoRechazo: string | null;
  resumen: ResumenLote;
}

export interface FilaLoteImportacionContable {
  id: string;
  linea: number;
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId: string;
  serie: string | null;
  responsableId: string | null;
  areaId: string | null;
  ubicacionId: string | null;
  valorPatrimonial: number | null;
  crudo: Record<string, string>;
  dryRunResultado: DryRunFila | null;
  dryRunMotivo: string | null;
}

export interface LoteConFilas {
  lote: LoteImportacionContable;
  filas: FilaLoteImportacionContable[];
}
