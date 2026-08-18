import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import {
  AdministradorPatrimonialGuard,
  ADMINISTRADOR_PATRIMONIAL_ROLE,
  ADMINISTRADOR_SISTEMA_ROLE,
  verificarRolAdministradorPatrimonial,
  verificarRolesPermitidos,
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

describe('verificarRolAdministradorPatrimonial', () => {
  // DOC-012 2: el rol es de Proyecto pero asignado por organizacion — el chequeo siempre es
  // "¿tiene el rol EN ESTA organizacion?", nunca "¿tiene el rol en alguna organizacion?" (ese
  // segundo criterio permitia a un admin de la Org A escribir sobre activos de la Org B, hallazgo
  // real de revision de seguridad).
  it('no lanza cuando la organizacion tiene el rol requerido', () => {
    expect(() =>
      verificarRolAdministradorPatrimonial(
        { 'org-1': [ADMINISTRADOR_PATRIMONIAL_ROLE] },
        'org-1',
      ),
    ).not.toThrow();
  });

  it('lanza 403 si la organizacion no tiene el rol, aunque otra organizacion si lo tenga', () => {
    expect(() =>
      verificarRolAdministradorPatrimonial(
        { 'org-2': [ADMINISTRADOR_PATRIMONIAL_ROLE] },
        'org-1',
      ),
    ).toThrow(ForbiddenException);
  });

  it('lanza 403 si rolesPorOrganizacion no trae la organizacion', () => {
    expect(() => verificarRolAdministradorPatrimonial({}, 'org-1')).toThrow(
      ForbiddenException,
    );
  });

  it('lanza 403 si rolesPorOrganizacion no es un objeto', () => {
    expect(() =>
      verificarRolAdministradorPatrimonial(undefined, 'org-1'),
    ).toThrow(ForbiddenException);
    expect(() =>
      verificarRolAdministradorPatrimonial('org-1', 'org-1'),
    ).toThrow(ForbiddenException);
  });

  it('lanza 403 si el valor de la organizacion no es un array', () => {
    expect(() =>
      verificarRolAdministradorPatrimonial(
        { 'org-1': ADMINISTRADOR_PATRIMONIAL_ROLE },
        'org-1',
      ),
    ).toThrow(ForbiddenException);
  });
});

describe('verificarRolesPermitidos', () => {
  // DOC-021 2 — Contrato acepta administrador-patrimonial O administrador-sistema; el resto de
  // escrituras oficiales (Activo, Catalogo, Documento) siguen aceptando solo un rol (via el
  // wrapper verificarRolAdministradorPatrimonial de arriba, que delega en esta funcion).
  it('no lanza si el operador tiene CUALQUIERA de los roles permitidos en esa organizacion', () => {
    expect(() =>
      verificarRolesPermitidos(
        { 'org-1': [ADMINISTRADOR_SISTEMA_ROLE] },
        'org-1',
        [ADMINISTRADOR_PATRIMONIAL_ROLE, ADMINISTRADOR_SISTEMA_ROLE],
      ),
    ).not.toThrow();
    expect(() =>
      verificarRolesPermitidos(
        { 'org-1': [ADMINISTRADOR_PATRIMONIAL_ROLE] },
        'org-1',
        [ADMINISTRADOR_PATRIMONIAL_ROLE, ADMINISTRADOR_SISTEMA_ROLE],
      ),
    ).not.toThrow();
  });

  it('lanza 403 si no tiene ninguno de los roles permitidos en esa organizacion', () => {
    expect(() =>
      verificarRolesPermitidos({ 'org-1': ['directivo'] }, 'org-1', [
        ADMINISTRADOR_PATRIMONIAL_ROLE,
        ADMINISTRADOR_SISTEMA_ROLE,
      ]),
    ).toThrow(ForbiddenException);
  });

  // El circulo de DOC-021 1: administrador-sistema nunca puede escribir informacion patrimonial,
  // administrador-patrimonial nunca puede administrar la plataforma.
  it('administrador-sistema no alcanza cuando el endpoint solo permite administrador-patrimonial', () => {
    expect(() =>
      verificarRolesPermitidos(
        { 'org-1': [ADMINISTRADOR_SISTEMA_ROLE] },
        'org-1',
        [ADMINISTRADOR_PATRIMONIAL_ROLE],
      ),
    ).toThrow(ForbiddenException);
  });

  it('administrador-patrimonial no alcanza cuando el endpoint solo permite administrador-sistema', () => {
    expect(() =>
      verificarRolesPermitidos(
        { 'org-1': [ADMINISTRADOR_PATRIMONIAL_ROLE] },
        'org-1',
        [ADMINISTRADOR_SISTEMA_ROLE],
      ),
    ).toThrow(ForbiddenException);
  });
});

describe('AdministradorPatrimonialGuard', () => {
  const guard = new AdministradorPatrimonialGuard();

  it('permite la request cuando rolesPorOrganizacion tiene el rol en organizacionId y ServiceTokenGuard ya corrio', () => {
    const context = buildContext({
      organizacionId: 'org-1',
      rolesPorOrganizacion: { 'org-1': [ADMINISTRADOR_PATRIMONIAL_ROLE] },
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('lanza 403 si el rol esta en otra organizacion distinta de organizacionId', () => {
    const context = buildContext({
      organizacionId: 'org-1',
      rolesPorOrganizacion: { 'org-2': [ADMINISTRADOR_PATRIMONIAL_ROLE] },
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lanza 403 si el body no trae rolesPorOrganizacion', () => {
    const context = buildContext({ organizacionId: 'org-1' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lanza 403 si el body es undefined', () => {
    const context = buildContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  // Endurecido tras revision de seguridad (DOC-012 3.2): este guard nunca debe ser la unica
  // defensa — si ServiceTokenGuard no corrio antes (falla cerrada, no importa si el resto del
  // body viene "correcto"), rechaza. Evita que un endpoint futuro olvide encadenar
  // ServiceTokenGuard y deje la autorizacion de escritura oficial dependiendo solo de campos
  // auto-declarados en el body.
  it('lanza 403 si ServiceTokenGuard no corrio antes, aunque el resto del body sea valido', () => {
    const context = buildContext(
      {
        organizacionId: 'org-1',
        rolesPorOrganizacion: { 'org-1': [ADMINISTRADOR_PATRIMONIAL_ROLE] },
      },
      { serviceAuthenticated: false },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lanza 403 si serviceAuthenticated no esta seteado en la request', () => {
    const context = buildContext(
      {
        organizacionId: 'org-1',
        rolesPorOrganizacion: { 'org-1': [ADMINISTRADOR_PATRIMONIAL_ROLE] },
      },
      { serviceAuthenticated: undefined },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
