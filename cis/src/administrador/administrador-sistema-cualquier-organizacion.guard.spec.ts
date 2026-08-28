import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdministradorSistemaEnCualquierOrganizacionGuard } from './administrador-sistema-cualquier-organizacion.guard';
import type { AuthenticatedRequest } from '../common/auth/keycloak-auth.guard';

function buildContext(auth?: AuthenticatedRequest['auth']): ExecutionContext {
  const request = { auth };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AdministradorSistemaEnCualquierOrganizacionGuard', () => {
  const guard = new AdministradorSistemaEnCualquierOrganizacionGuard();

  it('permite el acceso cuando el rol administrador-sistema esta firmado en cualquier organizacion', () => {
    const context = buildContext({
      operadorId: 'op-1',
      accessToken: 'token-1',
      expiresAt: '2026-01-01T00:00:00.000Z',
      rolesPorOrganizacion: {
        'zitadel-org-1': ['administrador-patrimonial'],
        'zitadel-org-2': ['administrador-sistema'],
      },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rechaza con 403 cuando el operador no tiene el rol administrador-sistema en ninguna organizacion', () => {
    const context = buildContext({
      operadorId: 'op-1',
      accessToken: 'token-1',
      expiresAt: '2026-01-01T00:00:00.000Z',
      rolesPorOrganizacion: {
        'zitadel-org-1': ['administrador-patrimonial'],
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rechaza con 403 cuando la request no trae contexto de auth (sin rolesPorOrganizacion)', () => {
    const context = buildContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
