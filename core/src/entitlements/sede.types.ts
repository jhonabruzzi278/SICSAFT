// Gap 2 (flujo real Admin->Directivo->Profesional AFT) — hasta este incremento `sedes` solo se
// poblaba por el seed de desarrollo (migrations/1755000000001_seed-dev-fixture.ts), sin
// repository/endpoint propio (solo se leía via JOIN dentro de ContratoRepository, mismo punto de
// partida que tenía `organizaciones` antes de DOC-021). A diferencia de Organizacion, acá SÍ es
// CORE quien genera el `id` (no hay ningún sistema externo con el que calzar, ver
// sede.repository.ts).
// DOC-024 1 — `estado` es bookkeeping de CORE, sin cascada a Zitadel ni a Contrato (ver DOC-024
// 1).
export type EstadoSede = 'activo' | 'inactivo';

export interface Sede {
  id: string;
  organizacionId: string;
  nombre: string;
  estado: EstadoSede;
}

export interface NuevaSedeInput {
  organizacionId: string;
  nombre: string;
}
