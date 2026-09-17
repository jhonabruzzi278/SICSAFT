import type { MigrationBuilder } from 'node-pg-migrate';

// aidlc-docs/cip/design-artifacts (notificaciones del organigrama de Controles de área,
// 2026-09-16) — el organigrama de core/frontend necesita distinguir sesiones `aceptable`/
// `defectuoso` que el Directivo ya revisó de las que todavía no, para que el contador de
// notificación por Área/Departamento baje cuando se atienden. `revisado_por` guarda quién la
// marcó (el claim de Keycloak propagado desde CIS, mismo criterio que RF-E con
// `areaOperativa`) — sin FK a un `usuarios` propio de CIP porque CIP no modela identidad
// (DOC-018 2.5).
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('veredicto_sesion', {
    revisado: { type: 'boolean', notNull: true, default: false },
    revisado_por: { type: 'text' },
    revisado_en: { type: 'timestamptz' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('veredicto_sesion', [
    'revisado',
    'revisado_por',
    'revisado_en',
  ]);
}
