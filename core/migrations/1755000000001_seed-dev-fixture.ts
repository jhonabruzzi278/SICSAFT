import type { MigrationBuilder } from 'node-pg-migrate';
import { SEED_CONTRATOS } from '../src/entitlements/contrato.seed';

// Datos de desarrollo/CI — NO es el mecanismo de carga de datos de produccion (eso llega en la
// Fase 4 del roadmap: importacion real via el rol Administrador Patrimonial, Tomo III §1.4).
// Generados a partir de SEED_CONTRATOS (core/src/entitlements/contrato.seed.ts) para que exista
// una unica fuente de verdad del caso DUOC UC/Melipilla — antes estaba retipeado a mano acá y en
// cis/src/qr-connector/qr-connector.seed.ts (esa segunda copia sigue pendiente hasta que CIS deje
// de ser mock en la Fase 3 del roadmap, ver ROADMAP.md).

export async function up(pgm: MigrationBuilder): Promise<void> {
  for (const contrato of SEED_CONTRATOS) {
    await pgm.db.query(
      'INSERT INTO organizaciones (id, nombre) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [contrato.organizacionId, contrato.organizacionNombre],
    );

    for (const sede of contrato.sedes) {
      await pgm.db.query(
        'INSERT INTO sedes (id, organizacion_id, nombre) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [sede.id, contrato.organizacionId, sede.nombre],
      );
    }

    await pgm.db.query(
      `INSERT INTO contratos
         (id, organizacion_id, vigencia_desde, vigencia_hasta, estado, modulos_contratados)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        contrato.id,
        contrato.organizacionId,
        contrato.vigenciaDesde,
        contrato.vigenciaHasta,
        contrato.estado,
        contrato.modulosContratados,
      ],
    );

    for (const sede of contrato.sedes) {
      await pgm.db.query(
        'INSERT INTO contrato_sedes (contrato_id, sede_id) VALUES ($1, $2)',
        [contrato.id, sede.id],
      );
    }
  }
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  for (const contrato of SEED_CONTRATOS) {
    await pgm.db.query('DELETE FROM contrato_sedes WHERE contrato_id = $1', [
      contrato.id,
    ]);
    await pgm.db.query('DELETE FROM contratos WHERE id = $1', [contrato.id]);
    for (const sede of contrato.sedes) {
      await pgm.db.query('DELETE FROM sedes WHERE id = $1', [sede.id]);
    }
    await pgm.db.query('DELETE FROM organizaciones WHERE id = $1', [
      contrato.organizacionId,
    ]);
  }
}
