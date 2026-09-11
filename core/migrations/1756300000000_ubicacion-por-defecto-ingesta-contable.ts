import type { MigrationBuilder } from 'node-pg-migrate';

// DOC-029 RF-B — retrofit de los activos que la ingesta contable ya dio de alta sin ubicación.
//
// El Excel del especialista contable ubica los bienes por **área**, nunca por ubicación física, y
// hasta ahora la aprobación del lote no resolvía ninguna: los activos quedaban registrados en la
// BPI con `ubicacion_id` NULL. Pero el catálogo operativo exige área **y** ubicación no nulas
// (ActivoRepository.findCatalogo, DOC-006 2), así que esos activos existían pero eran invisibles
// en el catálogo del CCP, en las etiquetas y en el CIP, sin ningún error que lo delatara.
// `UbicacionRepository.resolverPorArea` cierra el hueco de acá en adelante; esta migración aplica
// la misma regla a lo ya importado, que si no se queda invisible para siempre.
//
// La regla, idéntica a la del código: se reusa la ubicación principal del área si la tiene, si no
// una ya asociada al área, y recién si no hay ninguna se crea una en la sede de la organización,
// que además queda como principal del área. Un área cuya organización todavía no tiene sede se
// saltea (sus activos siguen sin ubicación, igual que antes) en vez de fallar la migración.
//
// Solo toca filas con `ubicacion_id IS NULL`: nunca pisa una ubicación puesta a mano.
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    WITH areas_sin_ubicacion AS (
      SELECT DISTINCT a.area_id, a.organizacion_id
      FROM activos a
      WHERE a.ubicacion_id IS NULL AND a.area_id IS NOT NULL
    ),
    resueltas AS (
      SELECT
        asu.area_id,
        COALESCE(
          ar.ubicacion_principal_id,
          (SELECT u.id
             FROM ubicaciones u
             JOIN sedes s ON s.id = u.sede_id
            WHERE u.area_id = asu.area_id AND s.organizacion_id = asu.organizacion_id
            ORDER BY u.id
            LIMIT 1)
        ) AS ubicacion_id,
        (SELECT s.id
           FROM sedes s
          WHERE s.organizacion_id = asu.organizacion_id
          ORDER BY s.id
          LIMIT 1) AS sede_id
      FROM areas_sin_ubicacion asu
      JOIN areas ar ON ar.id = asu.area_id
    ),
    creadas AS (
      INSERT INTO ubicaciones (id, sede_id, area_id, dependencia)
      SELECT gen_random_uuid(), r.sede_id, r.area_id,
             'Sin relevar — creada por ingesta contable'
        FROM resueltas r
       WHERE r.ubicacion_id IS NULL AND r.sede_id IS NOT NULL
      RETURNING id, area_id
    ),
    finales AS (
      SELECT r.area_id, COALESCE(r.ubicacion_id, c.id) AS ubicacion_id
        FROM resueltas r
        LEFT JOIN creadas c ON c.area_id = r.area_id
    ),
    principal AS (
      UPDATE areas ar
         SET ubicacion_principal_id = f.ubicacion_id
        FROM finales f
       WHERE ar.id = f.area_id
         AND ar.ubicacion_principal_id IS NULL
         AND f.ubicacion_id IS NOT NULL
      RETURNING ar.id
    )
    UPDATE activos a
       SET ubicacion_id = f.ubicacion_id
      FROM finales f
     WHERE a.area_id = f.area_id
       AND a.ubicacion_id IS NULL
       AND f.ubicacion_id IS NOT NULL;
  `);
}

// Irreversible a propósito: revertir significaría adivinar cuáles de las ubicaciones y
// asignaciones existentes las puso esta migración y cuáles una persona después, y borrar
// ubicaciones va contra el invariante de que ningún registro oficial de la BPI se elimina
// (Tomo III 4.10). El `down` queda como no-op declarado, no como olvido.
export async function down(): Promise<void> {
  // Sin vuelta atrás: ver el comentario de arriba.
}
