import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import {
  AdministradorPatrimonialGuard,
  ADMINISTRADOR_PATRIMONIAL_ROLE,
} from './administrador-patrimonial.guard';

function buildContext(
  body: unknown,
  options: { serviceAuthenticated?: boolean } = { serviceAuthenticated: true },
): ExecutionContext {
  const request = { body, serviceAuthenticated: options.serviceAuthenticated };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('AdministradorPatrimonialGuard', () => {
  const guard = new AdministradorPatrimonialGuard();

  it('permite la request cuando roles incluye administrador-patrimonial y ServiceTokenGuard ya corrio', () => {
    const context = buildContext({ roles: [ADMINISTRADOR_PATRIMONIAL_ROLE] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite la request cuando roles trae otros roles ademas del requerido', () => {
    const context = buildContext({
      roles: ['operador', ADMINISTRADOR_PATRIMONIAL_ROLE],
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('lanza 403 si roles no incluye el rol requerido', () => {
    const context = buildContext({ roles: ['operador'] });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lanza 403 si el body no trae roles', () => {
    const context = buildContext({});
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lanza 403 si roles no es un array', () => {
    const context = buildContext({ roles: ADMINISTRADOR_PATRIMONIAL_ROLE });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lanza 403 si el body es undefined', () => {
    const context = buildContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  // Endurecido tras revision de seguridad (DOC-012 §3.2): este guard nunca debe ser la unica
  // defensa — si ServiceTokenGuard no corrio antes (falla cerrada, no importa si `roles` viene
  // "correcto"), rechaza. Evita que un endpoint futuro olvide encadenar ServiceTokenGuard y deje
  // la autorizacion de escritura oficial dependiendo solo de un campo auto-declarado en el body.
  it('lanza 403 si ServiceTokenGuard no corrio antes, aunque roles sea valido', () => {
    const context = buildContext(
      { roles: [ADMINISTRADOR_PATRIMONIAL_ROLE] },
      { serviceAuthenticated: false },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lanza 403 si serviceAuthenticated no esta seteado en la request', () => {
    const context = buildContext(
      { roles: [ADMINISTRADOR_PATRIMONIAL_ROLE] },
      { serviceAuthenticated: undefined },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
