import type { MigrationBuilder } from 'node-pg-migrate';

// cip/aidlc-docs/design-artifacts/DOC-018-cip-servicio-nestjs.md 4 — modelo de lectura de CIP.
// Ninguna de estas tablas se escribe desde un cliente externo: solo el worker de agregacion
// (src/agregacion/) las alimenta, consumiendo la cola `cip-eventos` que ya publica CORE
// (core/src/eventos-outbox/, PR #8). Claves por `codigo_qr`, no `activo_id` — GET /catalogo y
// GET /inventarios/:id de CORE no exponen el id interno del activo (DOC-018 2.5).

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('cobertura_organizacion', {
    organizacion_id: { type: 'text', primaryKey: true },
    activos_registrados: { type: 'integer', notNull: true, default: 0 },
    activos_escaneados: { type: 'integer', notNull: true, default: 0 },
    porcentaje_cobertura: { type: 'numeric', notNull: true, default: 0 },
    actualizado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createTable('control_area', {
    area_id: { type: 'text', primaryKey: true },
    organizacion_id: { type: 'text', notNull: true },
    controlada_en_periodo: { type: 'boolean', notNull: true, default: false },
    ultima_sesion_en: { type: 'timestamptz' },
  });
  pgm.createIndex('control_area', 'organizacion_id');

  pgm.createTable('veredicto_sesion', {
    sesion_id: { type: 'text', primaryKey: true },
    organizacion_id: { type: 'text', notNull: true },
    area_id: { type: 'text', notNull: true },
    veredicto: {
      type: 'text',
      notNull: true,
      check: "veredicto IN ('exitoso','aceptable','defectuoso')",
    },
    fecha_cierre: { type: 'timestamptz', notNull: true },
  });
  pgm.createIndex('veredicto_sesion', 'organizacion_id');

  pgm.createTable('activo_fuera_de_area', {
    codigo_qr: { type: 'text', primaryKey: true },
    organizacion_id: { type: 'text', notNull: true },
    area_real_id: { type: 'text', notNull: true },
    area_esperada_id: { type: 'text', notNull: true },
    detectado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.createIndex('activo_fuera_de_area', 'organizacion_id');

  pgm.createTable('activo_no_localizado', {
    codigo_qr: { type: 'text', primaryKey: true },
    organizacion_id: { type: 'text', notNull: true },
    desde_en: { type: 'timestamptz', notNull: true },
  });
  pgm.createIndex('activo_no_localizado', 'organizacion_id');

  // PK compuesta: EscaneoDetalle (GET /inventarios/:id) no expone un id de fila por escaneo.
  pgm.createTable('incidencia', {
    sesion_id: { type: 'text', notNull: true },
    codigo_qr: { type: 'text', notNull: true },
    organizacion_id: { type: 'text', notNull: true },
    observaciones: { type: 'text', notNull: true },
    fecha: { type: 'timestamptz', notNull: true },
  });
  pgm.addConstraint('incidencia', 'incidencia_pkey', {
    primaryKey: ['sesion_id', 'codigo_qr'],
  });
  pgm.createIndex('incidencia', 'organizacion_id');

  pgm.createTable('estado_activo_resumen', {
    organizacion_id: { type: 'text', notNull: true },
    estado: {
      type: 'text',
      notNull: true,
      check:
        "estado IN ('activo','mantenimiento','inactivo','dado_de_baja','en_transito','extraviado')",
    },
    cantidad: { type: 'integer', notNull: true, default: 0 },
  });
  pgm.addConstraint('estado_activo_resumen', 'estado_activo_resumen_pkey', {
    primaryKey: ['organizacion_id', 'estado'],
  });

  pgm.createTable('categoria_activo_resumen', {
    organizacion_id: { type: 'text', notNull: true },
    // '(todas)' = total sin filtrar por area (DOMAIN_MODEL.md 2) — NULL no sirve como parte de
    // una PK compuesta consistente.
    area_id: { type: 'text', notNull: true, default: '(todas)' },
    familia: { type: 'text', notNull: true },
    cantidad: { type: 'integer', notNull: true, default: 0 },
  });
  pgm.addConstraint(
    'categoria_activo_resumen',
    'categoria_activo_resumen_pkey',
    { primaryKey: ['organizacion_id', 'area_id', 'familia'] },
  );

  // Auxiliar para el conteo incremental de cobertura (DOC-018 5.1 punto 4) — no forma parte del
  // modelo de lectura expuesto por la API, es contabilidad interna del worker.
  pgm.createTable('activo_escaneado_alguna_vez', {
    codigo_qr: { type: 'text', primaryKey: true },
    organizacion_id: { type: 'text', notNull: true },
  });
  pgm.createIndex('activo_escaneado_alguna_vez', 'organizacion_id');

  pgm.createTable('sync_estado', {
    singleton: { type: 'text', primaryKey: true, default: 'global' },
    ultimo_evento_procesado_en: { type: 'timestamptz' },
    al_dia: { type: 'boolean', notNull: true, default: true },
  });
  pgm.sql(`INSERT INTO sync_estado (singleton) VALUES ('global');`);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('sync_estado');
  pgm.dropTable('activo_escaneado_alguna_vez');
  pgm.dropTable('categoria_activo_resumen');
  pgm.dropTable('estado_activo_resumen');
  pgm.dropTable('incidencia');
  pgm.dropTable('activo_no_localizado');
  pgm.dropTable('activo_fuera_de_area');
  pgm.dropTable('veredicto_sesion');
  pgm.dropTable('control_area');
  pgm.dropTable('cobertura_organizacion');
}
