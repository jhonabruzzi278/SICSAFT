import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ServiceTokenGuard, SERVICE_TOKEN_HEADER } from './service-token.guard';
import type { ServiceTokenConfig } from './service-token.config';

const CONFIG: ServiceTokenConfig = { token: 'secreto-compartido' };

function buildContext(
  headerValue: string | string[] | undefined,
): ExecutionContext {
  const request = { headers: { [SERVICE_TOKEN_HEADER]: headerValue } };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ServiceTokenGuard', () => {
  const guard = new ServiceTokenGuard(CONFIG);

  it('permite la request cuando el header coincide con el token configurado', () => {
    expect(guard.canActivate(buildContext('secreto-compartido'))).toBe(true);
  });

  it('marca request.serviceAuthenticated en true cuando el token es valido', () => {
    const context = buildContext('secreto-compartido');
    guard.canActivate(context);

    const request = context
      .switchToHttp()
      .getRequest<{ serviceAuthenticated?: boolean }>();
    expect(request.serviceAuthenticated).toBe(true);
  });

  it('lanza 401 si falta el header', () => {
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('lanza 401 si el token no coincide', () => {
    expect(() => guard.canActivate(buildContext('token-invalido'))).toThrow(
      UnauthorizedException,
    );
  });

  it('lanza 401 si el token tiene distinta longitud que el esperado', () => {
    expect(() => guard.canActivate(buildContext('corto'))).toThrow(
      UnauthorizedException,
    );
  });

  it('usa el primer valor si el header viene duplicado', () => {
    expect(
      guard.canActivate(buildContext(['secreto-compartido', 'token-invalido'])),
    ).toBe(true);
  });
});
