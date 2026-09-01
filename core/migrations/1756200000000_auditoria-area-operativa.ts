import type { MigrationBuilder } from 'node-pg-migrate';

// DOC-029 RF-E — el pedido del usuario para la Auditoría del CCP es "donde dice usuario poner
// área, operación, revisar". Para poder mostrar y filtrar por el **área operativa** del actor,
// `auditoria` gana una columna. Aditivo y nullable: el histórico y los flujos que todavía no
// propagan un área (escrituras patrimoniales genéricas, eventos sin humano) quedan en NULL.
//
// Fuente del dato hoy: `POST /inventarios` (una acción de control ES sobre un área — `payload.areaId`,
// ver OrquestadorService.procesarInventario). Las escrituras patrimoniales lo tomarán del claim de
// Keycloak cuando CIS lo propague (DOC-029 RF-E E.3) — hasta entonces, NULL.

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('auditoria', {
    area_operativa: { type: 'text' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('auditoria', 'area_operativa');
}
