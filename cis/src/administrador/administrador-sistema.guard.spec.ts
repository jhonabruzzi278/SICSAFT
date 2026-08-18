import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdministradorSistemaGuard } from './administrador-sistema.guard';
import type { AuthenticatedRequest } from '../common/auth/zitadel-auth.guard';

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
  it('permite el acceso cuando el rol administrador-sistema esta firmado para la organizacion del :orgId', () => {
    const guard = new AdministradorSistemaGuard({
      'zitadel-org-1': 'duoc-uc',
    });
    const context = buildContext(
      { orgId: 'duoc-uc' },
      {
        operadorId: 'op-1',
        accessToken: 'token-1',
        expiresAt: '2026-01-01T00:00:00.000Z',
        rolesPorOrganizacion: {
          'zitadel-org-1': ['administrador-sistema'],
        },
      },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rechaza con 403 cuando el operador no tiene el rol administrador-sistema en esa organizacion', () => {
    const guard = new AdministradorSistemaGuard({
      'zitadel-org-1': 'duoc-uc',
    });
    const context = buildContext(
      { orgId: 'duoc-uc' },
      {
        operadorId: 'op-1',
        accessToken: 'token-1',
        expiresAt: '2026-01-01T00:00:00.000Z',
        rolesPorOrganizacion: {
          'zitadel-org-1': ['administrador-patrimonial'],
        },
      },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rechaza con 403 cuando el :orgId no esta mapeado a ninguna organizacion de Zitadel', () => {
    const guard = new AdministradorSistemaGuard({
      'zitadel-org-1': 'duoc-uc',
    });
    const context = buildContext(
      { orgId: 'organizacion-sin-mapeo' },
      {
        operadorId: 'op-1',
        accessToken: 'token-1',
        expiresAt: '2026-01-01T00:00:00.000Z',
        rolesPorOrganizacion: {
          'zitadel-org-1': ['administrador-sistema'],
        },
      },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rechaza con 403 cuando la request no trae contexto de auth (sin rolesPorOrganizacion)', () => {
    const guard = new AdministradorSistemaGuard({
      'zitadel-org-1': 'duoc-uc',
    });
    const context = buildContext({ orgId: 'duoc-uc' }, undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
