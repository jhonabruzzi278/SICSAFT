import type { MigrationBuilder } from 'node-pg-migrate';

// DOC-033 (extensión) — el organigrama que arma el Profesional de AFT desde el Excel pasa a
// modelar 4 niveles: Organización -> Dirección (`areas.dependencia`, ya existía) -> Departamento
// (nuevo) -> Área. Mismo tratamiento que `dependencia`/`centro_costo`: texto libre, nullable,
// opcional en toda la cadena (no todas las organizaciones necesitan el nivel intermedio). Se
// agrega también a la bandeja de staging de la ingesta contable (`importacion_contable_lote_fila`)
// para que el Excel pueda traer una columna DEPARTAMENTO igual que ya trae DIRECCION.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('areas', {
    departamento: { type: 'text' },
  });
  pgm.addColumn('importacion_contable_lote_fila', {
    departamento_nombre: { type: 'text' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('importacion_contable_lote_fila', ['departamento_nombre']);
  pgm.dropColumn('areas', ['departamento']);
}
