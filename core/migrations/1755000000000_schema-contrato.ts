import type { MigrationBuilder } from 'node-pg-migrate';

// Primera migracion real de CORE — reemplaza el `core.sql` que antes aplicaba
// devops/local/postgres/init/02-core.sh a mano (sin versionar, sin down). Mismo esquema que
// documenta base-patrimonial/DOC-004-modelo-contrato.md §2, ahora con node-pg-migrate como
// fuente unica de verdad del esquema (local, CI y, cuando exista, produccion).

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Organizacion: solo cache de lectura del org_id/nombre que administra Zitadel (fuente de
  // verdad de identidad) — ver DOC-004 §2 "Organización". Nunca se escribe de vuelta a Zitadel.
  pgm.createTable('organizaciones', {
    id: { type: 'text', primaryKey: true },
    nombre: { type: 'text', notNull: true },
  });

  // Sede: unidad gruesa de cobertura contractual (DOC-004 §2 "Sede").
  pgm.createTable('sedes', {
    id: { type: 'text', primaryKey: true },
    organizacion_id: {
      type: 'text',
      notNull: true,
      references: 'organizaciones',
    },
    nombre: { type: 'text', notNull: true },
  });

  pgm.createTable('contratos', {
    id: { type: 'text', primaryKey: true },
    organizacion_id: {
      type: 'text',
      notNull: true,
      references: 'organizaciones',
    },
    vigencia_desde: { type: 'timestamptz', notNull: true },
    // NULL = indefinido, vigente hasta cancelacion explicita (DOC-004 §2 "Contrato").
    vigencia_hasta: { type: 'timestamptz' },
    estado: {
      type: 'text',
      notNull: true,
      check: "estado IN ('vigente', 'suspendido', 'vencido', 'cancelado')",
    },
    // Vocabulario controlado de DOC-004 §5 — hoy solo existe 'inventario-qr'.
    modulos_contratados: {
      type: 'text[]',
      notNull: true,
      default: pgm.func('ARRAY[]::text[]'),
    },
    creado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  // Relacion N:N contrato<->sede (DOC-004 §2: "un contrato puede cubrir varias sedes"). El
  // invariante "una sede, un contrato vigente" (DOC-004 §4) no se enforcea acá con una
  // constraint — se valida en la capa de aplicacion
  // (assertInvarianteSedeUnContratoVigente en core/src/entitlements/contrato.seed.ts).
  pgm.createTable('contrato_sedes', {
    contrato_id: {
      type: 'text',
      notNull: true,
      references: 'contratos',
      onDelete: 'CASCADE',
    },
    sede_id: {
      type: 'text',
      notNull: true,
      references: 'sedes',
      onDelete: 'CASCADE',
    },
  });
  pgm.addConstraint('contrato_sedes', 'contrato_sedes_pkey', {
    primaryKey: ['contrato_id', 'sede_id'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('contrato_sedes');
  pgm.dropTable('contratos');
  pgm.dropTable('sedes');
  pgm.dropTable('organizaciones');
}
