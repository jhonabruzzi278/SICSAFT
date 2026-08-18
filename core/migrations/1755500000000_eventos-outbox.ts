import type { MigrationBuilder } from 'node-pg-migrate';

// Fase 6 (ROADMAP.md, cip/aidlc-docs/design-artifacts/DOC-014-cip-dashboard.md 1/6):
// transactional outbox para la publicacion de eventos hacia el CIP. Un trigger `AFTER INSERT ON
// eventos`, no un INSERT manual en `EventoRepository.registrar`/`registrarContrato` — garantiza
// que ningun evento relevante para CIP se pierde sin depender de que cada call site futuro se
// acuerde de escribir tambien en la outbox (mismo razonamiento en
// `cip/aidlc-docs/design-artifacts/DOMAIN_MODEL.md` 1). `gen_random_uuid()` es funcion nativa de
// Postgres desde la version 13, sin extension adicional (imagen `postgres:16-alpine`).
//
// Que tipos de evento importan a CIP (filtro del trigger): ver DOC-014/ARCHITECTURE.md 3 — no
// todos, en particular NO `escaneo_qr` disparado por cada lectura individual sin agrupar (por eso
// se guarda `sesion_id` cuando el evento lo trae en `detalle`, para que el dispatcher pueda
// agrupar por sesion en vez de publicar un mensaje por escaneo, ver ARCHITECTURE.md 4).
const TIPOS_RELEVANTES_PARA_CIP = [
  'alta',
  'escaneo_qr',
  'mantenimiento',
  'inactivo',
  'baja',
  'reincorporacion',
  'traslado',
] as const;

function tiposInSql(valores: readonly string[]): string {
  return valores.map((v) => `'${v}'`).join(', ');
}

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('eventos_outbox', {
    id: { type: 'text', primaryKey: true },
    evento_id: {
      type: 'text',
      notNull: true,
      references: 'eventos',
      onDelete: 'CASCADE',
    },
    tipo: { type: 'text', notNull: true },
    // Nullable: solo `escaneo_qr` trae `sesionId` en `detalle` hoy (ver
    // InventariosService.registrarEventosDeEscaneo) — el resto se procesa individualmente.
    sesion_id: { type: 'text' },
    publicado: { type: 'boolean', notNull: true, default: false },
    creado_en: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
    publicado_en: { type: 'timestamptz' },
  });
  pgm.createIndex('eventos_outbox', 'publicado');
  pgm.createIndex('eventos_outbox', 'sesion_id');

  pgm.sql(`
    CREATE FUNCTION fn_eventos_outbox_insertar() RETURNS trigger AS $$
    BEGIN
      IF NEW.tipo IN (${tiposInSql(TIPOS_RELEVANTES_PARA_CIP)}) THEN
        INSERT INTO eventos_outbox (id, evento_id, tipo, sesion_id)
        VALUES (gen_random_uuid()::text, NEW.id, NEW.tipo, NEW.detalle ->> 'sesionId');
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER trg_eventos_outbox
    AFTER INSERT ON eventos
    FOR EACH ROW
    EXECUTE FUNCTION fn_eventos_outbox_insertar();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TRIGGER IF EXISTS trg_eventos_outbox ON eventos;');
  pgm.sql('DROP FUNCTION IF EXISTS fn_eventos_outbox_insertar();');
  pgm.dropTable('eventos_outbox');
}
