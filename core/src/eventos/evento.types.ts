// DOC-005 §6 (vocabulario completo) / DOC-010 (cuales se usan en Fase 2). Solo 'escaneo_qr',
// 'traslado' y 'movimiento' tienen escritor hoy — el resto queda reservado (Fase 4 o modulo
// futuro) sin romper el CHECK de la tabla `eventos` al agregarlos. 'contrato_actualizado'
// (DOC-012 §7, migracion 1755300000000) es el unico tipo que no apunta a un activo.
export type TipoEvento =
  | 'alta'
  | 'traslado'
  | 'escaneo_qr'
  | 'lectura_rfid'
  | 'cambio_responsable'
  | 'mantenimiento'
  | 'movimiento'
  | 'salida_autorizada'
  | 'salida_no_autorizada'
  | 'baja'
  | 'reincorporacion'
  | 'contrato_actualizado';

export interface RegistrarEventoInput {
  activoId: string;
  tipo: TipoEvento;
  usuario?: string;
  detalle?: Record<string, unknown>;
}

// DOC-012 §7 — evento `contrato_actualizado`, sin activo asociado (eventos.activo_id nullable
// desde la migracion 1755300000000).
export interface RegistrarEventoContratoInput {
  contratoId: string;
  tipo: 'contrato_actualizado';
  usuario?: string;
  detalle?: Record<string, unknown>;
}
