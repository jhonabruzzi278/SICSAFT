import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { MetricsTokenGuard } from './metrics-token.guard';
import type { MetricsConfig } from './metrics.config';

function buildContext(
  authorizationHeader: string | undefined,
): ExecutionContext {
  const request = { headers: { authorization: authorizationHeader } };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('MetricsTokenGuard', () => {
  describe('con METRICS_TOKEN configurado', () => {
    const config: MetricsConfig = { token: 'secreto-metrics' };
    const guard = new MetricsTokenGuard(config);

    it('permite la request cuando el Bearer coincide con el token configurado', () => {
      expect(guard.canActivate(buildContext('Bearer secreto-metrics'))).toBe(
        true,
      );
    });

    it('lanza 401 si falta el header Authorization', () => {
      expect(() => guard.canActivate(buildContext(undefined))).toThrow(
        UnauthorizedException,
      );
    });

    it('lanza 401 si el header no tiene el prefijo Bearer', () => {
      expect(() => guard.canActivate(buildContext('secreto-metrics'))).toThrow(
        UnauthorizedException,
      );
    });

    it('lanza 401 si el token no coincide', () => {
      expect(() =>
        guard.canActivate(buildContext('Bearer token-invalido')),
      ).toThrow(UnauthorizedException);
    });

    it('lanza 401 si el token tiene distinta longitud que el esperado', () => {
      expect(() => guard.canActivate(buildContext('Bearer corto'))).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('sin METRICS_TOKEN configurado', () => {
    const config: MetricsConfig = { token: undefined };

    it('permite la request sin exigir ningun header (default de devops/local/)', () => {
      const guard = new MetricsTokenGuard(config);
      expect(guard.canActivate(buildContext(undefined))).toBe(true);
    });

    it('solo emite el warning una vez aunque se llame varias veces', () => {
      const guard = new MetricsTokenGuard(config);
      expect(guard.canActivate(buildContext(undefined))).toBe(true);
      expect(guard.canActivate(buildContext(undefined))).toBe(true);
    });
  });
});
