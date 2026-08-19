import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import {
  DirectivoGuard,
  requireDirectivoOrganizacionId,
  type DirectivoRequest,
} from './directivo.guard';
import type { AuthenticatedRequest } from '../common/auth/zitadel-auth.guard';

function buildContext(auth?: AuthenticatedRequest['auth']): {
  context: ExecutionContext;
  request: DirectivoRequest;
} {
  const request: DirectivoRequest = { auth } as DirectivoRequest;
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('DirectivoGuard', () => {
  it('permite el acceso y fija directivoOrganizacionId cuando el rol directivo esta firmado en exactamente una organizacion', () => {
    const guard = new DirectivoGuard();
    const { context, request } = buildContext({
      operadorId: 'op-1',
      accessToken: 'token-1',
      expiresAt: '2026-01-01T00:00:00.000Z',
      rolesPorOrganizacion: {
        'zitadel-org-1': ['directivo'],
      },
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.directivoOrganizacionId).toBe('zitadel-org-1');
  });

  it('rechaza con 403 cuando el operador no tiene el rol directivo en ninguna organizacion', () => {
    const guard = new DirectivoGuard();
    const { context } = buildContext({
      operadorId: 'op-1',
      accessToken: 'token-1',
      expiresAt: '2026-01-01T00:00:00.000Z',
      rolesPorOrganizacion: {
        'zitadel-org-1': ['administrador-patrimonial'],
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rechaza con 403 cuando el rol directivo aparece en mas de una organizacion (ambiguo)', () => {
    const guard = new DirectivoGuard();
    const { context } = buildContext({
      operadorId: 'op-1',
      accessToken: 'token-1',
      expiresAt: '2026-01-01T00:00:00.000Z',
      rolesPorOrganizacion: {
        'zitadel-org-1': ['directivo'],
        'zitadel-org-2': ['directivo'],
      },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rechaza con 403 cuando la request no trae contexto de auth', () => {
    const guard = new DirectivoGuard();
    const { context } = buildContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

describe('requireDirectivoOrganizacionId', () => {
  it('devuelve el organizacionId cuando el guard ya lo fijo', () => {
    const request = {
      directivoOrganizacionId: 'zitadel-org-1',
    } as DirectivoRequest;

    expect(requireDirectivoOrganizacionId(request)).toBe('zitadel-org-1');
  });

  it('lanza 403 si se llama sin haber pasado por el guard', () => {
    const request = {} as DirectivoRequest;

    expect(() => requireDirectivoOrganizacionId(request)).toThrow(
      ForbiddenException,
    );
  });
});
