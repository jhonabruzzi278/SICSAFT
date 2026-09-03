import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import {
  AdministradorPatrimonialGuard,
  ADMINISTRADOR_PATRIMONIAL_ROLE,
  verificarRolAdministradorPatrimonial,
  verificarRolesPermitidos,
} from './administrador-patrimonial.guard';

// Rol NO patrimonial cualquiera, para ejercitar la variante multi-rol de verificarRolesPermitidos
// sin acoplar el test a un segundo rol de negocio concreto.
const OTRO_ROL = 'directivo';

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
  // Funcion generica: acepta una lista de roles permitidos en la organizacion. Hoy en produccion
  // solo se la usa con un unico rol (via verificarRolAdministradorPatrimonial); la variante
  // multi-rol se conserva y se ejercita aca.
  it('no lanza si el operador tiene CUALQUIERA de los roles permitidos en esa organizacion', () => {
    expect(() =>
      verificarRolesPermitidos({ 'org-1': [OTRO_ROL] }, 'org-1', [
        ADMINISTRADOR_PATRIMONIAL_ROLE,
        OTRO_ROL,
      ]),
    ).not.toThrow();
    expect(() =>
      verificarRolesPermitidos(
        { 'org-1': [ADMINISTRADOR_PATRIMONIAL_ROLE] },
        'org-1',
        [ADMINISTRADOR_PATRIMONIAL_ROLE, OTRO_ROL],
      ),
    ).not.toThrow();
  });

  it('lanza 403 si no tiene ninguno de los roles permitidos en esa organizacion', () => {
    expect(() =>
      verificarRolesPermitidos({ 'org-1': ['operador'] }, 'org-1', [
        ADMINISTRADOR_PATRIMONIAL_ROLE,
        OTRO_ROL,
      ]),
    ).toThrow(ForbiddenException);
  });

  it('un rol permitido en otra organizacion no alcanza para esta', () => {
    expect(() =>
      verificarRolesPermitidos(
        { 'org-2': [ADMINISTRADOR_PATRIMONIAL_ROLE] },
        'org-1',
        [ADMINISTRADOR_PATRIMONIAL_ROLE, OTRO_ROL],
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
