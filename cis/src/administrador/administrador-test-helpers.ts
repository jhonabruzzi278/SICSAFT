import type { Request } from 'express';
import type {
  AuthenticatedRequest,
  KeycloakAuthContext,
} from '../common/auth/keycloak-auth.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';

// Fixtures/helpers compartidos entre los 5 spec de administrador-*.controller.spec.ts — antes
// vivian duplicados dentro del unico administrador.controller.spec.ts (715 lineas).
export const CORRELATION_ID = 'correlation-test';

export function buildAuthenticatedRequest(
  auth: KeycloakAuthContext,
): AuthenticatedRequest & RequestWithCorrelationId {
  return { auth, correlationId: CORRELATION_ID } as AuthenticatedRequest &
    RequestWithCorrelationId &
    Request;
}

export function correlationRequest(): RequestWithCorrelationId {
  return { correlationId: CORRELATION_ID } as RequestWithCorrelationId;
}

export const AUTH: KeycloakAuthContext = {
  operadorId: 'op-1',
  accessToken: 'keycloak-token',
  expiresAt: '2026-08-12T10:15:00.000Z',
  rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
};
