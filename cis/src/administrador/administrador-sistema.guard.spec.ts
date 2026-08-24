import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdministradorSistemaGuard } from './administrador-sistema.guard';
import { OrganizacionMappingDinamicoService } from './organizacion-mapping-dinamico.service';
import type { AuthenticatedRequest } from '../common/auth/zitadel-auth.guard';

function buildContext(
  params: Record<string, string>,
  auth?: AuthenticatedRequest['auth'],
): ExecutionContext {
  const request = { params, auth };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function buildOrganizacionMappingDinamico() {
  return {
    registrar: jest.fn(),
    resolverOrganizacionId: jest.fn(),
    resolverZitadelOrgId: jest.fn(),
  } as unknown as jest.Mocked<OrganizacionMappingDinamicoService>;
}

describe('AdministradorSistemaGuard', () => {
  it('permite el acceso cuando el rol administrador-sistema esta firmado para la organizacion del :orgId (mapeo estatico)', async () => {
    const organizacionMappingDinamico = buildOrganizacionMappingDinamico();
    const guard = new AdministradorSistemaGuard(
      { 'zitadel-org-1': 'duoc-uc' },
      organizacionMappingDinamico,
    );
    const context = buildContext(
      { orgId: 'duoc-uc' },
      {
        operadorId: 'op-1',
        accessToken: 'token-1',
        expiresAt: '2026-01-01T00:00:00.000Z',
        rolesPorOrganizacion: {
          'zitadel-org-1': ['administrador-sistema'],
        },
      },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(organizacionMappingDinamico.resolverOrganizacionId).not.toHaveBeenCalled();
  });

  // Gap 0 (hallazgo real) — este guard tenia su propia traduccion, separada de
  // AdministradorService.traducirAOrganizacionesCore, que nunca consultaba el mapeo dinamico.
  it('Gap 0: permite el acceso cuando el mapeo estatico no tiene la organizacion pero el mapeo dinamico si', async () => {
    const organizacionMappingDinamico = buildOrganizacionMappingDinamico();
    organizacionMappingDinamico.resolverOrganizacionId.mockResolvedValue(
      'org-nueva',
    );
    const guard = new AdministradorSistemaGuard({}, organizacionMappingDinamico);
    const context = buildContext(
      { orgId: 'org-nueva' },
      {
        operadorId: 'op-1',
        accessToken: 'token-1',
        expiresAt: '2026-01-01T00:00:00.000Z',
        rolesPorOrganizacion: {
          'zitadel-org-nueva': ['administrador-sistema'],
        },
      },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(
      organizacionMappingDinamico.resolverOrganizacionId,
    ).toHaveBeenCalledWith('zitadel-org-nueva');
  });

  it('rechaza con 403 cuando el operador no tiene el rol administrador-sistema en esa organizacion', async () => {
    const organizacionMappingDinamico = buildOrganizacionMappingDinamico();
    const guard = new AdministradorSistemaGuard(
      { 'zitadel-org-1': 'duoc-uc' },
      organizacionMappingDinamico,
    );
    const context = buildContext(
      { orgId: 'duoc-uc' },
      {
        operadorId: 'op-1',
        accessToken: 'token-1',
        expiresAt: '2026-01-01T00:00:00.000Z',
        rolesPorOrganizacion: {
          'zitadel-org-1': ['administrador-patrimonial'],
        },
      },
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rechaza con 403 cuando el :orgId no esta mapeado a ninguna organizacion de Zitadel (ni estatico ni dinamico)', async () => {
    const organizacionMappingDinamico = buildOrganizacionMappingDinamico();
    organizacionMappingDinamico.resolverOrganizacionId.mockResolvedValue(null);
    const guard = new AdministradorSistemaGuard(
      { 'zitadel-org-1': 'duoc-uc' },
      organizacionMappingDinamico,
    );
    const context = buildContext(
      { orgId: 'organizacion-sin-mapeo' },
      {
        operadorId: 'op-1',
        accessToken: 'token-1',
        expiresAt: '2026-01-01T00:00:00.000Z',
        rolesPorOrganizacion: {
          'zitadel-org-1': ['administrador-sistema'],
        },
      },
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rechaza con 403 cuando la request no trae contexto de auth (sin rolesPorOrganizacion)', async () => {
    const organizacionMappingDinamico = buildOrganizacionMappingDinamico();
    const guard = new AdministradorSistemaGuard(
      { 'zitadel-org-1': 'duoc-uc' },
      organizacionMappingDinamico,
    );
    const context = buildContext({ orgId: 'duoc-uc' }, undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
