import type { MigrationBuilder } from 'node-pg-migrate';

// DOC-029 RF-B — bandeja de staging para la ingesta de Excel supervisada. Un lote llega desde el
// ETL (herramientas/etl-contable) via CIS y NO toca la Base Patrimonial hasta que el Profesional
// de AFT lo aprueba desde el CCP. No es un registro oficial de Base Patrimonial (Tomo III 4.10 no
// aplica: es una bandeja de entrada) — igual usa `estado` en vez de borrar, por trazabilidad; un
// job de limpieza de lotes cerrados viejos es aceptable, a diferencia de activos/responsables.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('importacion_contable_lote', {
    id: { type: 'text', primaryKey: true },
    organizacion_id: {
      type: 'text',
      notNull: true,
      references: 'organizaciones',
    },
    origen: {
      type: 'text',
      notNull: true,
      check: "origen IN ('carpeta', 'manual')",
    },
    archivo_nombre: { type: 'text' },
    recibido_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    estado: {
      type: 'text',
      notNull: true,
      default: 'pendiente_revision',
      check: "estado IN ('pendiente_revision', 'aprobado', 'rechazado')",
    },
    revisado_por: { type: 'text' },
    revisado_en: { type: 'timestamptz' },
    motivo_rechazo: { type: 'text' },
    resumen: { type: 'jsonb', notNull: true, default: '{}' },
  });
  pgm.createIndex('importacion_contable_lote', ['organizacion_id', 'estado']);

  pgm.createTable('importacion_contable_lote_fila', {
    id: { type: 'text', primaryKey: true },
    lote_id: {
      type: 'text',
      notNull: true,
      references: 'importacion_contable_lote',
      onDelete: 'CASCADE',
    },
    linea: { type: 'integer', notNull: true },
    // Fila canonica — misma forma que FilaImportacionContable. El ETL ya resolvio los nombres del
    // Excel (dirección/área/responsable/categoría) a ids reales llamando a los endpoints ya
    // existentes de CORE; aca llegan resueltos.
    codigo_patrimonial: { type: 'text', notNull: true },
    codigo_qr: { type: 'text', notNull: true },
    catalogo_id: { type: 'text', notNull: true },
    serie: { type: 'text' },
    responsable_id: { type: 'text' },
    area_id: { type: 'text' },
    ubicacion_id: { type: 'text' },
    valor_patrimonial: { type: 'numeric' },
    // Texto crudo del Excel del cliente (columna -> valor) para que el revisor vea qué llegó, sin
    // depender de que los ids resueltos sean legibles (DOC-029 RF-B, "reflejar el Excel tal cual").
    crudo: { type: 'jsonb', notNull: true, default: '{}' },
    // Dry-run: qué haría esta fila al aprobar. Mismos valores que ResultadoFila de la importación
    // directa (DOC-012 6) — la importación no actualiza activos existentes, solo crea.
    dry_run_resultado: {
      type: 'text',
      check: "dry_run_resultado IN ('crear', 'ya_importado', 'conflicto')",
    },
    dry_run_motivo: { type: 'text' },
  });
  pgm.createIndex('importacion_contable_lote_fila', 'lote_id');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('importacion_contable_lote_fila');
  pgm.dropTable('importacion_contable_lote');
}
