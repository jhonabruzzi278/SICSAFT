import type { Contrato } from './contrato.types';

// Ya no es la fuente de datos de produccion (eso es Postgres real, ver
// devops/local/postgres/init/schema/core.sql y ContratoRepository) — queda como fixture de tests
// y como referencia textual del mismo caso de negocio que cis/src/qr-connector/qr-connector.seed.ts
// (DUOC UC, contrato vigente solo para la sede Melipilla). Si este seed cambia, el SQL de
// core.sql debe actualizarse a mano para seguir representando el mismo caso.
export const SEED_CONTRATOS: readonly Contrato[] = [
  {
    id: 'contrato-duoc-uc-melipilla',
    organizacionId: 'duoc-uc',
    organizacionNombre: 'DUOC UC',
    sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
    vigenciaDesde: '2026-01-01T00:00:00.000Z',
    vigenciaHasta: null,
    estado: 'vigente',
    modulosContratados: ['inventario-qr'],
  },
];

// DOC-004 §4: una sede no puede estar cubierta por mas de un contrato vigente a la vez. Se
// valida al cargar el modulo (no en cada request) — si alguien agrega un contrato al seed que
// viola el invariante, falla rapido en vez de servir datos ambiguos silenciosamente.
export function assertInvarianteSedeUnContratoVigente(
  contratos: readonly Contrato[],
): void {
  const sedesVistas = new Set<string>();
  for (const contrato of contratos) {
    if (contrato.estado !== 'vigente') {
      continue;
    }
    for (const sede of contrato.sedes) {
      if (sedesVistas.has(sede.id)) {
        throw new Error(
          `Invariante violado (DOC-004 §4): la sede '${sede.id}' esta cubierta por mas de un contrato vigente`,
        );
      }
      sedesVistas.add(sede.id);
    }
  }
}

assertInvarianteSedeUnContratoVigente(SEED_CONTRATOS);
