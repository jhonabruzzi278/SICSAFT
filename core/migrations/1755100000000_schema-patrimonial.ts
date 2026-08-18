import type { MigrationBuilder } from 'node-pg-migrate';

// DOC-005 (base-patrimonial/DOC-005-modelo-patrimonial.md): Area, Ubicacion, Responsable,
// Catalogo de Activos, Activo (Base Patrimonial Central), Inventario, Evento, Auditoria. Mismo
// mecanismo que la migracion 1755000000000 (DOC-004/Contrato) — node-pg-migrate, up/down reales.

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Area y Responsable se referencian mutuamente (DOC-005 2, "por que Area/Responsable no
  // tienen ciclo estricto de creacion") — se crean sin esas dos columnas primero, se agregan
  // por ALTER una vez que ambas tablas (y Ubicacion, para ubicacion_principal_id) existen.
  pgm.createTable('areas', {
    id: { type: 'text', primaryKey: true },
    organizacion_id: {
      type: 'text',
      notNull: true,
      references: 'organizaciones',
    },
    codigo: { type: 'text', notNull: true },
    nombre: { type: 'text', notNull: true },
    dependencia: { type: 'text' },
    centro_costo: { type: 'text' },
  });

  pgm.createTable('ubicaciones', {
    id: { type: 'text', primaryKey: true },
    sede_id: { type: 'text', notNull: true, references: 'sedes' },
    edificio: { type: 'text' },
    piso: { type: 'text' },
    area_id: { type: 'text', references: 'areas' },
    oficina: { type: 'text' },
    dependencia: { type: 'text' },
  });

  pgm.createTable('responsables', {
    id: { type: 'text', primaryKey: true },
    identificacion: { type: 'text', notNull: true, unique: true },
    nombre: { type: 'text', notNull: true },
    cargo: { type: 'text' },
    area_id: { type: 'text', notNull: true, references: 'areas' },
    correo: { type: 'text' },
    telefono: { type: 'text' },
    estado: {
      type: 'text',
      notNull: true,
      check: "estado IN ('activo', 'inactivo')",
    },
  });

  // Cierra el ciclo Area <-> Responsable/Ubicacion (DOC-005 2) — ambas nullable, sin
  // constraint de aplicacion todavia (queda para el Motor Patrimonial, Fase 2).
  pgm.addColumns('areas', {
    responsable_id: { type: 'text', references: 'responsables' },
    ubicacion_principal_id: { type: 'text', references: 'ubicaciones' },
  });

  pgm.createTable('catalogo_activos', {
    id: { type: 'text', primaryKey: true },
    tipo: { type: 'text', notNull: true },
    familia: { type: 'text', notNull: true },
    subfamilia: { type: 'text' },
    marca: { type: 'text' },
    modelo: { type: 'text' },
    fabricante: { type: 'text' },
    vida_util_meses: { type: 'integer' },
    criticidad: {
      type: 'text',
      notNull: true,
      check: "criticidad IN ('baja', 'media', 'alta')",
    },
    // DOC-005 2: hoy solo 'qr' tiene datos reales — 'rfid'/'qr_rfid' reservados sin
    // implementar (Etapa 1 del roadmap tecnologico, Tomo III 1.2).
    tecnologia_identificacion: {
      type: 'text',
      notNull: true,
      check: "tecnologia_identificacion IN ('qr', 'rfid', 'qr_rfid')",
    },
  });

  pgm.createTable('activos', {
    id: { type: 'text', primaryKey: true },
    codigo_patrimonial: { type: 'text', notNull: true, unique: true },
    codigo_qr: { type: 'text', notNull: true, unique: true },
    rfid: { type: 'text', unique: true },
    organizacion_id: {
      type: 'text',
      notNull: true,
      references: 'organizaciones',
    },
    catalogo_id: {
      type: 'text',
      notNull: true,
      references: 'catalogo_activos',
    },
    serie: { type: 'text' },
    // DOC-005 4 — 'en_mantenimiento' deliberadamente fuera (Tomo III 4.15 lo marca "modulo
    // futuro").
    estado: {
      type: 'text',
      notNull: true,
      check:
        "estado IN ('activo', 'en_transito', 'extraviado', 'dado_de_baja')",
    },
    responsable_id: { type: 'text', references: 'responsables' },
    area_id: { type: 'text', references: 'areas' },
    ubicacion_id: { type: 'text', references: 'ubicaciones' },
    valor_patrimonial: { type: 'numeric' },
    fecha_alta: { type: 'date', notNull: true },
    creado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
  pgm.createIndex('activos', 'organizacion_id');
  pgm.createIndex('activos', 'area_id');
  pgm.createIndex('activos', 'ubicacion_id');
  pgm.createIndex('activos', 'catalogo_id');

  pgm.createTable('inventarios', {
    id: { type: 'text', primaryKey: true },
    activo_id: { type: 'text', notNull: true, references: 'activos' },
    fecha: { type: 'date', notNull: true },
    usuario: { type: 'text', notNull: true },
    metodo: {
      type: 'text',
      notNull: true,
      check: "metodo IN ('qr', 'rfid', 'web')",
    },
    // DOC-005 5 — las 8 categorias que hoy resuelve app-qr-sicsaft/src/lib/scan-resolve.ts del
    // lado del cliente, migran a CORE en la Fase 2/3 del ROADMAP.
    resultado: {
      type: 'text',
      notNull: true,
      check:
        "resultado IN ('correcto', 'otra_area', 'otra_ubicacion', 'no_registrado', 'codigo_invalido', 'duplicado', 'ya_escaneado', 'con_incidencia')",
    },
    observaciones: { type: 'text' },
  });
  pgm.createIndex('inventarios', 'activo_id');

  pgm.createTable('eventos', {
    id: { type: 'text', primaryKey: true },
    activo_id: { type: 'text', notNull: true, references: 'activos' },
    // DOC-005 6, vocabulario de Tomo III 4.7.
    tipo: {
      type: 'text',
      notNull: true,
      check:
        "tipo IN ('alta', 'traslado', 'escaneo_qr', 'lectura_rfid', 'cambio_responsable', 'mantenimiento', 'movimiento', 'salida_autorizada', 'salida_no_autorizada', 'baja', 'reincorporacion')",
    },
    fecha: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    usuario: { type: 'text' },
    detalle: { type: 'jsonb' },
  });
  pgm.createIndex('eventos', 'activo_id');
  pgm.createIndex('eventos', 'tipo');

  // DOC-005 7 — sin FK a activos a proposito: audita cualquier operacion del ecosistema, no
  // solo las que tocan un activo.
  pgm.createTable('auditoria', {
    id: { type: 'text', primaryKey: true },
    usuario: { type: 'text', notNull: true },
    fecha: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    equipo: { type: 'text' },
    ip: { type: 'text' },
    operacion: { type: 'text', notNull: true },
    resultado: { type: 'text', notNull: true },
    observaciones: { type: 'text' },
  });
  pgm.createIndex('auditoria', 'fecha');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('auditoria');
  pgm.dropTable('eventos');
  pgm.dropTable('inventarios');
  pgm.dropTable('activos');
  pgm.dropTable('catalogo_activos');
  pgm.dropColumns('areas', ['responsable_id', 'ubicacion_principal_id']);
  pgm.dropTable('responsables');
  pgm.dropTable('ubicaciones');
  pgm.dropTable('areas');
}
