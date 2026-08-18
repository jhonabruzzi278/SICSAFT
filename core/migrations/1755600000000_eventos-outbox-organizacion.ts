import type { MigrationBuilder } from 'node-pg-migrate';

// cip/aidlc-docs/design-artifacts/DOC-018-cip-servicio-nestjs.md 2 — encontrado al diseñar el
// worker de CIP: el mensaje `{ kind: 'evento', eventoId, tipo }` no alcanza, el worker necesita
// `organizacionId` para recalcular agregados y CIP no puede leer la base `core` directamente
// (RNF-01, DOC-014). No se edita la migracion 1755500000000 ya mergeada (PR #8) — se agrega la
// columna y se reemplaza la funcion del trigger (mismo trigger, no hace falta recrearlo).

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('eventos_outbox', {
    organizacion_id: { type: 'text' },
  });
  pgm.createIndex('eventos_outbox', 'organizacion_id');

  pgm.sql(`
    CREATE OR REPLACE FUNCTION fn_eventos_outbox_insertar() RETURNS trigger AS $$
    BEGIN
      IF NEW.tipo IN ('alta', 'escaneo_qr', 'mantenimiento', 'inactivo', 'baja', 'reincorporacion', 'traslado') THEN
        INSERT INTO eventos_outbox (id, evento_id, tipo, sesion_id, organizacion_id)
        SELECT
          gen_random_uuid()::text,
          NEW.id,
          NEW.tipo,
          NEW.detalle ->> 'sesionId',
          activos.organizacion_id
        FROM (SELECT NEW.id AS id) AS uno
        LEFT JOIN activos ON activos.id = NEW.activo_id;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION fn_eventos_outbox_insertar() RETURNS trigger AS $$
    BEGIN
      IF NEW.tipo IN ('alta', 'escaneo_qr', 'mantenimiento', 'inactivo', 'baja', 'reincorporacion', 'traslado') THEN
        INSERT INTO eventos_outbox (id, evento_id, tipo, sesion_id)
        VALUES (gen_random_uuid()::text, NEW.id, NEW.tipo, NEW.detalle ->> 'sesionId');
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.dropColumns('eventos_outbox', ['organizacion_id']);
}
