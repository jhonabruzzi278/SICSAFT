import type { MigrationBuilder } from 'node-pg-migrate';

// DOC-012 §7 (escritura de Contrato, Fase 4 item 5): `eventos.activo_id` era NOT NULL — un evento
// `contrato.actualizado` no apunta a ningun activo, apunta a un contrato. Mismo criterio que la
// migracion 1755200000000 aplico para `inventarios.activo_id` (no_registrado/invalido tampoco
// apuntan a un activo real): se agrega `eventos.contrato_id` (nullable, FK a contratos) y
// `eventos.activo_id` pasa a nullable. El CHECK de `tipo` se extiende con 'contrato_actualizado'
// (DOC-012 §7 — sin publicacion a cola todavia, el evento queda solo en `eventos`/`auditoria`).

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
] as const;

const NEW_TIPO_VALUES = [...OLD_TIPO_VALUES, 'contrato_actualizado'] as const;

function tipoCheckSql(valores: readonly string[]): string {
  const lista = valores.map((v) => `'${v}'`).join(', ');
  return `tipo IN (${lista})`;
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('eventos', 'activo_id', { notNull: false });
  pgm.addColumns('eventos', {
    contrato_id: { type: 'text', references: 'contratos', onDelete: 'CASCADE' },
  });
  pgm.createIndex('eventos', 'contrato_id');

  pgm.dropConstraint('eventos', 'eventos_tipo_check');
  pgm.addConstraint('eventos', 'eventos_tipo_check', {
    check: tipoCheckSql(NEW_TIPO_VALUES),
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('eventos', 'eventos_tipo_check');
  pgm.addConstraint('eventos', 'eventos_tipo_check', {
    check: tipoCheckSql(OLD_TIPO_VALUES),
  });

  pgm.dropColumns('eventos', ['contrato_id']);
  pgm.alterColumn('eventos', 'activo_id', { notNull: true });
}
