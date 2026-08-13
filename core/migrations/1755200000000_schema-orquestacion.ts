import type { MigrationBuilder } from 'node-pg-migrate';

// Fase 2 (core/aidlc-docs/design-artifacts/DOC-006-api-cis-core.md §0): corrige dos hallazgos
// del diseno sobre la migracion 1755100000000 (DOC-005), ya compartida — no se edita esa
// migracion, se corrige con una nueva:
//
// 1. `inventarios.resultado` usaba 'codigo_invalido'; el contrato ya construido en
//    cis/src/qr-connector/qr-connector.schemas.ts (scanResultadoSchema) usa 'invalido' a secas.
// 2. Faltaba una entidad que agrupe los escaneos de una misma sesion de inventario — DOC-002
//    confirma que `POST /inventarios` envia una sesion cerrada completa (`escaneos: []`), no un
//    escaneo suelto por request. `sesiones_inventario` es esa entidad; `inventarios.sesion_id`
//    (nullable — las dos filas de seed de Fase 1 no vienen de una sesion real) la referencia.
// 3. Descubierto al implementar el Motor de Reglas (DOC-009): un escaneo puede clasificar como
//    `no_registrado`/`invalido` — sin ningun activo real al que apuntar. `inventarios.activo_id`
//    era NOT NULL y la tabla no guardaba el codigo escaneado crudo, asi que no habia forma de
//    persistir esos casos (el motivo mismo por el que existe el Motor de Reglas). Se agrega
//    `inventarios.codigo_qr` (siempre conocido, es lo que el operador escaneo) y `activo_id` pasa
//    a nullable.

const OLD_RESULTADO_VALUES = [
  'correcto',
  'otra_area',
  'otra_ubicacion',
  'no_registrado',
  'codigo_invalido',
  'duplicado',
  'ya_escaneado',
  'con_incidencia',
] as const;

const NEW_RESULTADO_VALUES = [
  'correcto',
  'otra_area',
  'otra_ubicacion',
  'no_registrado',
  'invalido',
  'duplicado',
  'ya_escaneado',
  'con_incidencia',
] as const;

function resultadoCheckSql(valores: readonly string[]): string {
  const lista = valores.map((v) => `'${v}'`).join(', ');
  return `resultado IN (${lista})`;
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('sesiones_inventario', {
    id: { type: 'text', primaryKey: true },
    idempotency_key: { type: 'text', notNull: true, unique: true },
    organizacion_id: {
      type: 'text',
      notNull: true,
      references: 'organizaciones',
    },
    area_id: { type: 'text', notNull: true, references: 'areas' },
    ubicacion_id: { type: 'text', notNull: true, references: 'ubicaciones' },
    operador_id: { type: 'text', notNull: true },
    correlation_id: { type: 'text', notNull: true },
    fecha_inicio: { type: 'timestamptz', notNull: true },
    fecha_cierre: { type: 'timestamptz', notNull: true },
    estado: {
      type: 'text',
      notNull: true,
      check: "estado IN ('pendiente', 'recibido', 'rechazado')",
    },
    // Detecta idempotencyKey reusada con un payload distinto (DOC-006 §3 / DOC-002 §5).
    request_hash: { type: 'text', notNull: true },
    creado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.addColumns('inventarios', {
    sesion_id: {
      type: 'text',
      references: 'sesiones_inventario',
      onDelete: 'CASCADE',
    },
    // Nullable primero: se backfillea desde activos.codigo_qr abajo antes de exigir NOT NULL.
    codigo_qr: { type: 'text' },
  });
  pgm.createIndex('inventarios', 'sesion_id');

  pgm.sql(`
    UPDATE inventarios
    SET codigo_qr = activos.codigo_qr
    FROM activos
    WHERE activos.id = inventarios.activo_id AND inventarios.codigo_qr IS NULL
  `);
  pgm.alterColumn('inventarios', 'codigo_qr', { notNull: true });
  // Un escaneo `no_registrado`/`invalido` no resuelve a ningun activo real.
  pgm.alterColumn('inventarios', 'activo_id', { notNull: false });

  pgm.dropConstraint('inventarios', 'inventarios_resultado_check');
  pgm.addConstraint('inventarios', 'inventarios_resultado_check', {
    check: resultadoCheckSql(NEW_RESULTADO_VALUES),
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint('inventarios', 'inventarios_resultado_check');
  pgm.addConstraint('inventarios', 'inventarios_resultado_check', {
    check: resultadoCheckSql(OLD_RESULTADO_VALUES),
  });

  pgm.alterColumn('inventarios', 'activo_id', { notNull: true });
  pgm.dropColumns('inventarios', ['codigo_qr', 'sesion_id']);
  pgm.dropTable('sesiones_inventario');
}
