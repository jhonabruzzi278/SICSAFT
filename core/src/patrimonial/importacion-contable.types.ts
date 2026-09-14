// DOC-012 6 — carga masiva de base contable. Cada fila trae lo mismo que NuevoActivoInput
// (organizacionId lo pone el request completo, no cada fila — DOC-012 3.3, un solo
// organizacionId por operacion de escritura oficial).
export interface FilaImportacionContable {
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId: string;
  serie?: string;
  responsableId?: string;
  areaId?: string;
  ubicacionId?: string;
  valorPatrimonial?: number;
  // DOC-033 — ISO 8601 (solo fecha), distinta de `fecha_alta` (cuándo el bien entró a la BPI).
  fechaCompra?: string;
}

// DOC-012 6 — "idempotente por fila, no por request completo": cada fila se resuelve
// independiente, nunca sobrescribe en silencio y nunca elimina.
export type ResultadoFila =
  | { codigoPatrimonial: string; resultado: 'creado' }
  | { codigoPatrimonial: string; resultado: 'ya_importado' }
  | { codigoPatrimonial: string; resultado: 'conflicto'; motivo: string };

export interface ImportacionContableResultado {
  filas: ResultadoFila[];
  creados: number;
  yaImportados: number;
  conflictos: number;
}
