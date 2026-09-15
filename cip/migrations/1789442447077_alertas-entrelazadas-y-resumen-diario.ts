import type { MigrationBuilder } from 'node-pg-migrate';

// DOC-034 (aidlc-docs/cip/design-artifacts/) — dos cambios de esquema pedidos juntos en la misma
// sesion:
// Parte A: `activo_fuera_de_area` no guardaba `sesion_id` (no habia forma de ir de una alerta al
// reporte que la genero) y su PK era solo `codigo_qr` (un UPSERT pisaba la deteccion de una
// sesion anterior). Se agrega `sesion_id`/`veredicto` y la PK pasa a ser compuesta, mismo patron
// que `incidencia` (sesion_id, codigo_qr).
// Parte B: tabla nueva `resumen_diario` para el corte nocturno (ResumenDiarioWorker, pg-boss
// schedule) que resume `veredicto_sesion` por dia y organizacion.
//
// CORRECCION (2026-09-15, encontrada contra una instalacion real con datos): la primera version
// de esta migracion asumia `activo_fuera_de_area` vacia en todo ambiente real y agregaba
// sesion_id/veredicto NOT NULL sin default -- rompe con `column "sesion_id" ... contains null
// values` en cuanto la tabla ya tiene filas (exactamente lo que paso: una organizacion real ya
// habia corrido controles con AFT fuera de area antes de este incremento). Esta tabla es un cache
// derivado 100% recomputable desde eventos de CORE (mismo criterio que el resto de
// AgregacionRepository, "todas las escrituras son upserts o DELETE+INSERT completos" --
// agregacion.service.ts), asi que se vacia primero: no hay forma de reconstruir retroactivamente
// a que sesion pertenecia cada fila vieja (ese dato nunca se guardo), y las alertas reales vuelven
// a aparecer solas en cuanto se cierre la proxima sesion de control.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DELETE FROM activo_fuera_de_area');
  pgm.addColumns('activo_fuera_de_area', {
    sesion_id: { type: 'text', notNull: true },
    veredicto: {
      type: 'text',
      notNull: true,
      check: "veredicto IN ('exitoso','aceptable','defectuoso')",
    },
  });
  pgm.dropConstraint('activo_fuera_de_area', 'activo_fuera_de_area_pkey');
  pgm.addConstraint('activo_fuera_de_area', 'activo_fuera_de_area_pkey', {
    primaryKey: ['sesion_id', 'codigo_qr'],
  });

  pgm.createTable('resumen_diario', {
    organizacion_id: { type: 'text', notNull: true },
    // Dia calendario (huso America/Santiago) que resume el corte nocturno, no la fecha del job.
    fecha: { type: 'date', notNull: true },
    total_sesiones: { type: 'integer', notNull: true, default: 0 },
    exitoso: { type: 'integer', notNull: true, default: 0 },
    aceptable: { type: 'integer', notNull: true, default: 0 },
    defectuoso: { type: 'integer', notNull: true, default: 0 },
    generado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.addConstraint('resumen_diario', 'resumen_diario_pkey', {
    primaryKey: ['organizacion_id', 'fecha'],
  });
  pgm.createIndex('resumen_diario', ['organizacion_id', { name: 'fecha', sort: 'DESC' }]);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('resumen_diario');

  pgm.dropConstraint('activo_fuera_de_area', 'activo_fuera_de_area_pkey');
  pgm.addConstraint('activo_fuera_de_area', 'activo_fuera_de_area_pkey', {
    primaryKey: ['codigo_qr'],
  });
  pgm.dropColumns('activo_fuera_de_area', ['sesion_id', 'veredicto']);
}
