import { ExecutionContext, HttpException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import type { KeycloakAuthContext } from '../common/auth/keycloak-auth.guard';

function buildContext(auth?: KeycloakAuthContext): ExecutionContext {
  const request = { auth };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function buildAuth(operadorId: string): KeycloakAuthContext {
  return {
    operadorId,
    accessToken: 'token',
    expiresAt: '2026-08-12T10:15:00.000Z',
    rolesPorOrganizacion: {},
  };
}

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  beforeEach(() => {
    guard = new RateLimitGuard({ maxRequests: 3, windowMs: 10_000 });
  });

  it('permite la request cuando no se supera el limite', () => {
    expect(guard.canActivate(buildContext(buildAuth('op-1')))).toBe(true);
  });

  it('aisla el limite entre operadores (clave distinta por operador)', () => {
    for (let i = 0; i < 3; i += 1) {
      guard.canActivate(buildContext(buildAuth('op-1')));
    }
    expect(() => guard.canActivate(buildContext(buildAuth('op-1')))).toThrow(
      HttpException,
    );

    // op-2 nunca consumió su propia ventana — no se ve afectado por op-1.
    expect(guard.canActivate(buildContext(buildAuth('op-2')))).toBe(true);
  });

  it('lanza 429 cuando se supera el limite', () => {
    for (let i = 0; i < 3; i += 1) {
      guard.canActivate(buildContext(buildAuth('op-1')));
    }

    try {
      guard.canActivate(buildContext(buildAuth('op-1')));
      throw new Error('no debería llegar acá');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toMatchObject({
        retryAfterMs: expect.any(Number) as number,
      });
    }
  });

  it('lanza 401 si no hay contexto de auth (KeycloakAuthGuard no corrio antes)', () => {
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      'No hay contexto de autenticación',
    );
  });
});
