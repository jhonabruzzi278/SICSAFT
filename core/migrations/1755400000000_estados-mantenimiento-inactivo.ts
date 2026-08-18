import type { MigrationBuilder } from 'node-pg-migrate';

// ROADMAP.md Fase 3.1 / DOC-017 (app-qr-sicsaft) / DOC-005 §4 / DOC-012 §5.1 — reabre la
// exclusion de 'mantenimiento' que DOC-005 §4 dejaba fuera (Tomo III §4.15 lo marca "modulo
// futuro", no prohibido) y agrega 'inactivo', a pedido explicito del usuario 2026-08-17. Ambas
// son transiciones declarables por cualquier operador de APP QR sin el rol
// administrador-patrimonial (Tomo III §1.4 ya le concede "registro de inventarios/estados" a esa
// entrada) — ver InventariosService. Aditivo: ninguna fila existente deja de ser valida.
//
// 'baja_sugerida' (eventos.tipo) es el evento informativo que registra que un operador sugirio
// la baja de un activo durante un control — no cambia activos.estado, la ejecuta el
// Administrador Patrimonial via POST /activos/:id/baja (sin cambios, DOC-012 §5.1).

const OLD_ESTADO_VALUES = [
  'activo',
  'en_transito',
  'extraviado',
  'dado_de_baja',
] as const;
const NEW_ESTADO_VALUES = [
  'activo',
  'en_transito',
  'extraviado',
  'mantenimiento',
  'inactivo',
  'dado_de_baja',
] as const;

const OLD_TIPO_VALUES = [
  'alta',
  'traslado',
  'escaneo_qr',
  'lectura_rfid',
  'cambio_responsable',
  'mantenimiento',
  'movimiento',
  'salida_autorizada',
  'salida_no_autorizada',
  'baja',
  'reincorporacion',
  'contrato_actualizado',
] as const;
const NEW_TIPO_VALUES = [...OLD_TIPO_VALUES, 'inactivo', 'baja_sugerida'] as const;

function checkSql(columna: string, valores: readonly string[]): string {
  const lista = valores.map((v) => `'${v}'`).join(', ');
  return `${columna} IN (${lista})`;
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('activos', 'activos_estado_check');
  pgm.addConstraint('activos', 'activos_estado_check', {
    check: checkSql('estado', NEW_ESTADO_VALUES),
  });

  pgm.dropConstraint('eventos', 'eventos_tipo_check');
  pgm.addConstraint('eventos', 'eventos_tipo_check', {
    check: checkSql('tipo', NEW_TIPO_VALUES),
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('eventos', 'eventos_tipo_check');
  pgm.addConstraint('eventos', 'eventos_tipo_check', {
    check: checkSql('tipo', OLD_TIPO_VALUES),
  });

  pgm.dropConstraint('activos', 'activos_estado_check');
  pgm.addConstraint('activos', 'activos_estado_check', {
    check: checkSql('estado', OLD_ESTADO_VALUES),
  });
}
