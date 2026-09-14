import type { MigrationBuilder } from 'node-pg-migrate';

// DOC-033 — el catálogo enriquecido de CCP pide "Fecha compra", "Marca" y "Modelo" por fila,
// alimentados desde el Excel contable. `activos.fecha_alta` ya existe pero significa "cuándo el
// bien entró a la BPI" (CURRENT_DATE fijo al crear, ver activo.repository.ts) — un concepto
// distinto de la fecha de compra real que trae el Excel del contador, así que se agrega una
// columna nueva en vez de reusar esa. `catalogo_activos.marca`/`modelo` ya existían (los llenaba
// solo el alta manual de CCP) — acá se agrega el mismo par a la bandeja de staging de la ingesta
// contable, que hoy los descarta por completo.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('activos', {
    fecha_compra: { type: 'date' },
  });
  pgm.addColumn('importacion_contable_lote_fila', {
    marca: { type: 'text' },
    modelo: { type: 'text' },
    fecha_compra: { type: 'date' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('importacion_contable_lote_fila', ['marca', 'modelo', 'fecha_compra']);
  pgm.dropColumn('activos', ['fecha_compra']);
}
