import type { InventarioRequest } from '../inventarios/inventarios.types';

// DOC-007 / core/aidlc-docs/design-artifacts/DOMAIN_MODEL.md — lo que arma el Orquestador antes
// de invocar cualquier motor. `operadorId`/`organizacionId` vienen del payload, no de un token:
// CORE no valida operadores directamente (eso ya lo hizo CIS via Zitadel antes de reenviar la
// request, ver ADR-002) — solo confia en que quien le habla es CIS (ServiceTokenGuard).
export interface ContextoOperacion {
  correlationId: string;
  operadorId: string;
  organizacionId: string;
  serviceCaller: 'cis';
}

export function buildContextoOperacion(
  payload: Pick<InventarioRequest, 'operadorId' | 'organizacionId'>,
  correlationId: string,
): ContextoOperacion {
  return {
    correlationId,
    operadorId: payload.operadorId,
    organizacionId: payload.organizacionId,
    serviceCaller: 'cis',
  };
}
