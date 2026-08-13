// DOC-005 §6 (vocabulario completo) / DOC-010 (cuales se usan en Fase 2). Solo 'escaneo_qr',
// 'traslado' y 'movimiento' tienen escritor hoy — el resto queda reservado (Fase 4 o modulo
// futuro) sin romper el CHECK de la tabla `eventos` al agregarlos.
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
  | 'reincorporacion';

export interface RegistrarEventoInput {
  activoId: string;
  tipo: TipoEvento;
  usuario?: string;
  detalle?: Record<string, unknown>;
}
