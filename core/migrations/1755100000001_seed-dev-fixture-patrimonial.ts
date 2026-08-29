import type { MigrationBuilder } from 'node-pg-migrate';

// Datos de desarrollo/CI — mismo caso de negocio que 1755000000001 (DUOC UC / Melipilla), ahora
// con un area, un responsable, una ubicacion, dos activos reales y su alta correspondiente. NO
// es el mecanismo de carga de datos de produccion (eso es la Fase 4 del ROADMAP: importacion via
// el rol Administrador Patrimonial, Tomo III 1.4). Sin fuente TS reusable todavia (a diferencia
// del seed de Contrato) porque no existe consumidor de este dominio hasta el Motor Patrimonial
// (Fase 2) — cuando exista, este seed se debe mover a un modulo TS y referenciarse desde acá,
// mismo patron que contrato.seed.ts.

const ORGANIZACION_ID = 'duoc-uc';
const SEDE_ID = 'melipilla';
const AREA_ID = 'area-biblioteca';
const UBICACION_ID = 'ubicacion-biblioteca-101';
const RESPONSABLE_ID = 'responsable-jperez';
const CATALOGO_NOTEBOOK_ID = 'catalogo-notebook';
const CATALOGO_PROYECTOR_ID = 'catalogo-proyector';
const ACTIVO_NOTEBOOK_ID = 'activo-notebook-001';
const ACTIVO_PROYECTOR_ID = 'activo-proyector-001';

// DOC-028 Fase B.1 — SOLO corre con SICSAFT_SEED_DEV=1 (ver 1755000000001_seed-dev-fixture.ts y
// core/migrations/README.md). Sin la env var, la migracion se registra pero no inserta nada:
// base patrimonial limpia en el .exe embebido, devops/prod y devops/onprem.
function seedHabilitado(): boolean {
  return process.env.SICSAFT_SEED_DEV === '1';
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  if (!seedHabilitado()) return;
  await pgm.db.query(
    `INSERT INTO areas (id, organizacion_id, codigo, nombre, dependencia, centro_costo)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      AREA_ID,
      ORGANIZACION_ID,
      'BIB',
      'Biblioteca',
      'Vicerrectoría Académica',
      'CC-100',
    ],
  );

  await pgm.db.query(
    `INSERT INTO ubicaciones (id, sede_id, edificio, piso, area_id, oficina)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [UBICACION_ID, SEDE_ID, 'A', '1', AREA_ID, '101'],
  );

  await pgm.db.query(
    `INSERT INTO responsables
       (id, identificacion, nombre, cargo, area_id, correo, telefono, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      RESPONSABLE_ID,
      '12345678-9',
      'Juan Pérez',
      'Encargado de Biblioteca',
      AREA_ID,
      'jperez@duocuc.cl',
      '+56912345678',
      'activo',
    ],
  );

  await pgm.db.query(
    `UPDATE areas SET responsable_id = $1, ubicacion_principal_id = $2 WHERE id = $3`,
    [RESPONSABLE_ID, UBICACION_ID, AREA_ID],
  );

  await pgm.db.query(
    `INSERT INTO catalogo_activos
       (id, tipo, familia, subfamilia, marca, modelo, fabricante, vida_util_meses, criticidad,
        tecnologia_identificacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      CATALOGO_NOTEBOOK_ID,
      'Equipo Computacional',
      'Informática',
      'Notebook',
      'Dell',
      'Latitude 5440',
      'Dell Inc.',
      48,
      'media',
      'qr',
    ],
  );
  await pgm.db.query(
    `INSERT INTO catalogo_activos
       (id, tipo, familia, subfamilia, marca, modelo, fabricante, vida_util_meses, criticidad,
        tecnologia_identificacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      CATALOGO_PROYECTOR_ID,
      'Equipo Audiovisual',
      'Multimedia',
      'Proyector',
      'Epson',
      'PowerLite X49',
      'Epson Corp.',
      60,
      'baja',
      'qr',
    ],
  );

  for (const activo of [
    {
      id: ACTIVO_NOTEBOOK_ID,
      codigoPatrimonial: 'AFT-2026-000001',
      codigoQr: 'QR-000001',
      catalogoId: CATALOGO_NOTEBOOK_ID,
      serie: 'DL5440-0001',
      valor: '850000',
    },
    {
      id: ACTIVO_PROYECTOR_ID,
      codigoPatrimonial: 'AFT-2026-000002',
      codigoQr: 'QR-000002',
      catalogoId: CATALOGO_PROYECTOR_ID,
      serie: 'EPX49-0001',
      valor: '420000',
    },
  ]) {
    await pgm.db.query(
      `INSERT INTO activos
         (id, codigo_patrimonial, codigo_qr, organizacion_id, catalogo_id, serie, estado,
          responsable_id, area_id, ubicacion_id, valor_patrimonial, fecha_alta)
       VALUES ($1, $2, $3, $4, $5, $6, 'activo', $7, $8, $9, $10, $11)`,
      [
        activo.id,
        activo.codigoPatrimonial,
        activo.codigoQr,
        ORGANIZACION_ID,
        activo.catalogoId,
        activo.serie,
        RESPONSABLE_ID,
        AREA_ID,
        UBICACION_ID,
        activo.valor,
        '2026-01-15',
      ],
    );

    await pgm.db.query(
      `INSERT INTO eventos (id, activo_id, tipo, usuario, detalle)
       VALUES ($1, $2, 'alta', $3, $4)`,
      [
        `evento-alta-${activo.id}`,
        activo.id,
        'jperez',
        JSON.stringify({ origen: 'seed-desarrollo' }),
      ],
    );

    await pgm.db.query(
      `INSERT INTO inventarios (id, activo_id, fecha, usuario, metodo, resultado)
       VALUES ($1, $2, $3, $4, 'qr', 'correcto')`,
      [`inventario-alta-${activo.id}`, activo.id, '2026-01-15', 'jperez'],
    );
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  if (!seedHabilitado()) return;
  for (const activoId of [ACTIVO_NOTEBOOK_ID, ACTIVO_PROYECTOR_ID]) {
    await pgm.db.query('DELETE FROM inventarios WHERE activo_id = $1', [
      activoId,
    ]);
    await pgm.db.query('DELETE FROM eventos WHERE activo_id = $1', [activoId]);
    await pgm.db.query('DELETE FROM activos WHERE id = $1', [activoId]);
  }
  await pgm.db.query('DELETE FROM catalogo_activos WHERE id IN ($1, $2)', [
    CATALOGO_NOTEBOOK_ID,
    CATALOGO_PROYECTOR_ID,
  ]);
  await pgm.db.query(
    'UPDATE areas SET responsable_id = NULL, ubicacion_principal_id = NULL WHERE id = $1',
    [AREA_ID],
  );
  await pgm.db.query('DELETE FROM responsables WHERE id = $1', [
    RESPONSABLE_ID,
  ]);
  await pgm.db.query('DELETE FROM ubicaciones WHERE id = $1', [UBICACION_ID]);
  await pgm.db.query('DELETE FROM areas WHERE id = $1', [AREA_ID]);
}
