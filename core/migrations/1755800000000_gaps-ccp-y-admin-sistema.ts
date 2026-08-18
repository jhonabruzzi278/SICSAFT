import type { MigrationBuilder } from 'node-pg-migrate';

// DOC-021 3 — cierra 2 de los 5 gaps que DOC-012 § "Cobertura real desde el CCP hoy" documento:
// "descripciones" (columna nueva en `activos`) y "documentacion y fotografias" (tabla nueva,
// version minima: `url` es un enlace externo que el operador ya subio a algun lado, sin bucket
// propio todavia — ver ROADMAP.md Fase 7 § "Idea futura sin disenar"). Los otros 3 gaps
// (estados/ciclo de vida de Activo, familias/categorias, importaciones) no necesitan migracion —
// ya tienen tabla (`catalogo_activos`) o endpoint (`activo-escritura.controller.ts`,
// `importacion-contable.*`) en CORE, solo faltaba el puente en CIS y la UI en WEB.

const OLD_TIPO_VALUES = [
  'alta',
  'traslado',
  'escaneo_qr',
  'lectura_rfid',
  'cambio_responsable',
  'mantenimiento',
  'inactivo',
  'movimiento',
  'salida_autorizada',
  'salida_no_autorizada',
  'baja',
  'baja_sugerida',
  'reincorporacion',
  'contrato_actualizado',
] as const;
const NEW_TIPO_VALUES = [...OLD_TIPO_VALUES, 'cambio_descripcion'] as const;

function checkSql(columna: string, valores: readonly string[]): string {
  const lista = valores.map((v) => `'${v}'`).join(', ');
  return `${columna} IN (${lista})`;
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('activos', {
    descripcion: { type: 'text' },
  });

  pgm.dropConstraint('eventos', 'eventos_tipo_check');
  pgm.addConstraint('eventos', 'eventos_tipo_check', {
    check: checkSql('tipo', NEW_TIPO_VALUES),
  });

  // No es parte de la BPI oficial (metadata operativa, no historial patrimonial) — a diferencia
  // de `activos`, admite DELETE real; no aplica el invariante "nunca elimina" de Tomo III 4.10.
  pgm.createTable('documentos_activo', {
    id: { type: 'text', primaryKey: true },
    activo_id: {
      type: 'text',
      notNull: true,
      references: 'activos',
      onDelete: 'CASCADE',
    },
    organizacion_id: { type: 'text', notNull: true },
    tipo: {
      type: 'text',
      notNull: true,
      check: "tipo IN ('documento', 'fotografia')",
    },
    url: { type: 'text', notNull: true },
    descripcion: { type: 'text' },
    creado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    creado_por: { type: 'text', notNull: true },
  });
  pgm.createIndex('documentos_activo', 'activo_id');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('documentos_activo');

  pgm.dropConstraint('eventos', 'eventos_tipo_check');
  pgm.addConstraint('eventos', 'eventos_tipo_check', {
    check: checkSql('tipo', OLD_TIPO_VALUES),
  });

  pgm.dropColumn('activos', 'descripcion');
}
