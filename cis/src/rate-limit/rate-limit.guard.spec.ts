import { ExecutionContext, HttpException } from '@nestjs/common';
import type { Redis } from 'ioredis';
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

describe('RateLimitGuard', () => {
  const auth: KeycloakAuthContext = {
    operadorId: 'op-1',
    accessToken: 'token',
    expiresAt: '2026-08-12T10:15:00.000Z',
    rolesPorOrganizacion: {},
  };
  let redis: jest.Mocked<Pick<Redis, 'eval' | 'pttl'>>;
  let guard: RateLimitGuard;

  beforeEach(() => {
    redis = { eval: jest.fn(), pttl: jest.fn() };
    guard = new RateLimitGuard(redis as unknown as Redis, {
      maxRequests: 3,
      windowMs: 10_000,
    });
  });

  it('permite la request cuando no se supera el limite', async () => {
    redis.eval.mockResolvedValue(1);

    await expect(guard.canActivate(buildContext(auth))).resolves.toBe(true);
  });

  it('usa una clave distinta por operador (aisla el limite entre operadores)', async () => {
    redis.eval.mockResolvedValue(1);

    await guard.canActivate(buildContext(auth));

    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'rate-limit:operador:op-1',
      10_000,
    );
  });

  it('lanza 429 cuando se supera el limite', async () => {
    redis.eval.mockResolvedValue(4);
    redis.pttl.mockResolvedValue(5_000);

    const promise = guard.canActivate(buildContext(auth));

    await expect(promise).rejects.toThrow(HttpException);
    await expect(promise).rejects.toMatchObject({
      status: 429,
      response: { retryAfterMs: 5_000 },
    });
  });

  it('lanza 401 si no hay contexto de auth (KeycloakAuthGuard no corrio antes)', async () => {
    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(
      'No hay contexto de autenticación',
    );
    expect(redis.eval).not.toHaveBeenCalled();
  });
});
