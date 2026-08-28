import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdministradorSistemaGuard } from './administrador-sistema.guard';
import type { AuthenticatedRequest } from '../common/auth/keycloak-auth.guard';

function buildContext(
  params: Record<string, string>,
  auth?: AuthenticatedRequest['auth'],
): ExecutionContext {
  const request = { params, auth };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AdministradorSistemaGuard', () => {
  const guard = new AdministradorSistemaGuard();

  // ADR-004 — ya no hay traduccion de ids: rolesPorOrganizacion viene keyed por el mismo
  // organizacionId que usa CORE (el alias de la Organization en Keycloak), asi que el guard
  // compara directo contra `:orgId` sin resolver nada.
  it('permite el acceso cuando el rol administrador-sistema esta firmado para la organizacion del :orgId', () => {
    const context = buildContext(
      { orgId: 'duoc-uc' },
      {
        operadorId: 'op-1',
        accessToken: 'token-1',
        expiresAt: '2026-01-01T00:00:00.000Z',
        rolesPorOrganizacion: {
          'duoc-uc': ['administrador-sistema'],
        },
      },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rechaza con 403 cuando el operador no tiene el rol administrador-sistema en esa organizacion', () => {
    const context = buildContext(
      { orgId: 'duoc-uc' },
      {
        operadorId: 'op-1',
        accessToken: 'token-1',
        expiresAt: '2026-01-01T00:00:00.000Z',
        rolesPorOrganizacion: {
          'duoc-uc': ['administrador-patrimonial'],
        },
      },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rechaza con 403 cuando el operador tiene el rol pero en otra organizacion', () => {
    const context = buildContext(
      { orgId: 'organizacion-sin-rol' },
      {
        operadorId: 'op-1',
        accessToken: 'token-1',
        expiresAt: '2026-01-01T00:00:00.000Z',
        rolesPorOrganizacion: {
          'duoc-uc': ['administrador-sistema'],
        },
      },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rechaza con 403 cuando la request no trae contexto de auth (sin rolesPorOrganizacion)', () => {
    const context = buildContext({ orgId: 'duoc-uc' }, undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
