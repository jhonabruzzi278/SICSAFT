import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { jwtVerify } from 'jose';
import {
  KeycloakAuthGuard,
  requireAuthContext,
  type AuthenticatedRequest,
} from './keycloak-auth.guard';
import type { KeycloakAuthConfig } from './keycloak-auth.config';
import type { KeycloakAdminService } from '../../keycloak-admin/keycloak-admin.service';
import { ROLES_POR_ORGANIZACION_CACHE_TTL_MS } from './keycloak-auth.constants';

jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
}));

const mockedJwtVerify = jwtVerify as jest.Mock;

const CONFIG: KeycloakAuthConfig = {
  issuer: 'http://id.sicsaft.localhost',
  audience: 'cis-api',
  jwksUri: 'http://id.sicsaft.localhost/protocol/openid-connect/certs',
};

function buildRequest(
  headers: Record<string, string | undefined>,
  correlationId?: string,
): AuthenticatedRequest & { correlationId?: string } {
  return { headers, correlationId } as unknown as AuthenticatedRequest & {
    correlationId?: string;
  };
}

function buildContext(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('KeycloakAuthGuard', () => {
  let keycloakAdminService: jest.Mocked<
    Pick<KeycloakAdminService, 'resolverRolesPorOrganizacionDeUsuario'>
  >;
  let guard: KeycloakAuthGuard;

  beforeEach(() => {
    mockedJwtVerify.mockReset();
    keycloakAdminService = {
      resolverRolesPorOrganizacionDeUsuario: jest.fn(),
    };
    guard = new KeycloakAuthGuard(
      CONFIG,
      jest.fn() as never,
      keycloakAdminService as unknown as KeycloakAdminService,
    );
  });

  it('lanza 401 si falta el header Authorization', async () => {
    const context = buildContext(buildRequest({}));

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Falta el header Authorization: Bearer <token>',
    );
    expect(mockedJwtVerify).not.toHaveBeenCalled();
  });

  it('lanza 401 si el header no empieza con "Bearer "', async () => {
    const context = buildContext(
      buildRequest({ authorization: 'Basic abc123' }),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lanza 401 si el token viene vacio despues de "Bearer "', async () => {
    const context = buildContext(buildRequest({ authorization: 'Bearer  ' }));

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Falta el header Authorization: Bearer <token>',
    );
  });

  it('lanza 401 si jwtVerify rechaza el token', async () => {
    mockedJwtVerify.mockRejectedValue(new Error('firma invalida'));
    const context = buildContext(
      buildRequest({ authorization: 'Bearer token-invalido' }),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Token inválido o vencido',
    );
  });

  it('lanza 401 si el payload no trae `sub`', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: { exp: 9999999999 } });
    const context = buildContext(
      buildRequest({ authorization: 'Bearer token-1' }),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      'El token no trae `sub`',
    );
  });

  it('lanza 401 si el payload no trae `exp`', async () => {
    mockedJwtVerify.mockResolvedValue({ payload: { sub: 'op-1' } });
    const context = buildContext(
      buildRequest({ authorization: 'Bearer token-1' }),
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      'El token no trae `exp`',
    );
  });

  it('setea request.auth con rolesPorOrganizacion vacio cuando el claim `organization` no viene (sin llamar al admin service)', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: { sub: 'op-1', exp: 9999999999 },
    });
    const request = buildRequest({ authorization: 'Bearer token-1' }, 'corr-1');
    const context = buildContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(request.auth).toEqual({
      operadorId: 'op-1',
      accessToken: 'token-1',
      expiresAt: new Date(9999999999 * 1000).toISOString(),
      rolesPorOrganizacion: {},
    });
    expect(
      keycloakAdminService.resolverRolesPorOrganizacionDeUsuario,
    ).not.toHaveBeenCalled();
  });

  it('ignora entradas no-string del claim `organization` (defensa ante un token mal formado)', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: { sub: 'op-1', exp: 9999999999, organization: ['duoc-uc', 42] },
    });
    keycloakAdminService.resolverRolesPorOrganizacionDeUsuario.mockResolvedValue(
      { 'duoc-uc': ['administrador-sistema'] },
    );
    const request = buildRequest({ authorization: 'Bearer token-1' }, 'corr-1');
    const context = buildContext(request);

    await guard.canActivate(context);

    expect(
      keycloakAdminService.resolverRolesPorOrganizacionDeUsuario,
    ).toHaveBeenCalledWith('op-1', ['duoc-uc'], 'corr-1');
  });

  it('resuelve rolesPorOrganizacion via KeycloakAdminService cuando el claim `organization` trae organizaciones', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: { sub: 'op-1', exp: 9999999999, organization: ['duoc-uc'] },
    });
    keycloakAdminService.resolverRolesPorOrganizacionDeUsuario.mockResolvedValue(
      { 'duoc-uc': ['administrador-sistema'] },
    );
    const request = buildRequest({ authorization: 'Bearer token-1' }, 'corr-1');
    const context = buildContext(request);

    await guard.canActivate(context);

    expect(request.auth?.rolesPorOrganizacion).toEqual({
      'duoc-uc': ['administrador-sistema'],
    });
  });

  it('usa un correlationId propio si la request no trae uno (CorrelationIdMiddleware no corrio)', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: { sub: 'op-1', exp: 9999999999, organization: ['duoc-uc'] },
    });
    keycloakAdminService.resolverRolesPorOrganizacionDeUsuario.mockResolvedValue(
      {},
    );
    const request = buildRequest({ authorization: 'Bearer token-1' });
    const context = buildContext(request);

    await guard.canActivate(context);

    const [, , correlationIdUsado] =
      keycloakAdminService.resolverRolesPorOrganizacionDeUsuario.mock.calls[0];
    expect(typeof correlationIdUsado).toBe('string');
    expect(correlationIdUsado.length).toBeGreaterThan(0);
  });

  it('cachea rolesPorOrganizacion por operador — una segunda request dentro del TTL no vuelve a llamar al admin service', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: { sub: 'op-1', exp: 9999999999, organization: ['duoc-uc'] },
    });
    keycloakAdminService.resolverRolesPorOrganizacionDeUsuario.mockResolvedValue(
      { 'duoc-uc': ['administrador-sistema'] },
    );
    const context = buildContext(
      buildRequest({ authorization: 'Bearer token-1' }, 'corr-1'),
    );

    await guard.canActivate(context);
    await guard.canActivate(
      buildContext(buildRequest({ authorization: 'Bearer token-1' }, 'corr-2')),
    );

    expect(
      keycloakAdminService.resolverRolesPorOrganizacionDeUsuario,
    ).toHaveBeenCalledTimes(1);
  });

  it('vuelve a resolver contra el admin service una vez vencido el TTL de la cache', async () => {
    const ahora = Date.now();
    const spyNow = jest.spyOn(Date, 'now');
    spyNow.mockReturnValue(ahora);

    mockedJwtVerify.mockResolvedValue({
      payload: { sub: 'op-1', exp: 9999999999, organization: ['duoc-uc'] },
    });
    keycloakAdminService.resolverRolesPorOrganizacionDeUsuario.mockResolvedValue(
      { 'duoc-uc': ['administrador-sistema'] },
    );

    await guard.canActivate(
      buildContext(buildRequest({ authorization: 'Bearer token-1' })),
    );
    spyNow.mockReturnValue(ahora + ROLES_POR_ORGANIZACION_CACHE_TTL_MS + 1);
    await guard.canActivate(
      buildContext(buildRequest({ authorization: 'Bearer token-1' })),
    );

    expect(
      keycloakAdminService.resolverRolesPorOrganizacionDeUsuario,
    ).toHaveBeenCalledTimes(2);
    spyNow.mockRestore();
  });
});

describe('requireAuthContext', () => {
  it('devuelve auth cuando ya esta seteado', () => {
    const auth = {
      operadorId: 'op-1',
      accessToken: 't',
      expiresAt: '2026-01-01T00:00:00.000Z',
      rolesPorOrganizacion: {},
    };
    const request = { auth } as AuthenticatedRequest;

    expect(requireAuthContext(request)).toBe(auth);
  });

  it('lanza 401 si no hay contexto de auth', () => {
    const request = {} as AuthenticatedRequest;

    expect(() => requireAuthContext(request)).toThrow(
      'No hay contexto de autenticación',
    );
  });
});
