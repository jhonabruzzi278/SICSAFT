import { DirectivoService } from './directivo.service';
import type { AuditoriaIdentidadService } from '../auditoria-identidad/auditoria-identidad.service';
import type { ZitadelAdminService } from '../zitadel-admin/zitadel-admin.service';
import type { GrantUsuario } from '../zitadel-admin/zitadel-admin.types';

describe('DirectivoService', () => {
  let zitadelAdminService: {
    buscarUsuarioPorEmail: jest.Mock;
    listarGrants: jest.Mock;
    crearGrant: jest.Mock;
    crearUsuarioHuman: jest.Mock;
  };
  let auditoriaIdentidad: { ejecutar: jest.Mock };
  let service: DirectivoService;

  beforeEach(() => {
    zitadelAdminService = {
      buscarUsuarioPorEmail: jest.fn(),
      listarGrants: jest.fn(),
      crearGrant: jest.fn(),
      crearUsuarioHuman: jest.fn(),
    };
    // DOC-024 3 — pass-through, mismo criterio que administrador.service.spec.ts: el
    // comportamiento real del wrapper tiene su propia cobertura en
    // auditoria-identidad.service.spec.ts.
    auditoriaIdentidad = {
      ejecutar: jest.fn((_operacion, _operadorId, _correlationId, accion) =>
        accion(),
      ),
    };
    service = new DirectivoService(
      zitadelAdminService as unknown as ZitadelAdminService,
      auditoriaIdentidad as unknown as AuditoriaIdentidadService,
    );
  });

  describe('listarUsuariosOrganizacion', () => {
    it('delega en ZitadelAdminService.listarGrants con el zitadelOrgId recibido', async () => {
      const grants: GrantUsuario[] = [
        {
          userId: 'usuario-1',
          email: 'a@duoc.cl',
          displayName: null,
          roles: ['administrador-patrimonial'],
        },
      ];
      zitadelAdminService.listarGrants.mockResolvedValue(grants);

      const resultado = await service.listarUsuariosOrganizacion(
        'zitadel-org-1',
        'correlation-1',
      );

      expect(resultado).toBe(grants);
      expect(zitadelAdminService.listarGrants).toHaveBeenCalledWith(
        'zitadel-org-1',
        'correlation-1',
      );
    });
  });

  describe('asignarProfesionalAft', () => {
    it('si el usuario ya existe en Zitadel, solo le asigna el rol administrador-patrimonial (no crea password)', async () => {
      zitadelAdminService.buscarUsuarioPorEmail.mockResolvedValue({
        id: 'usuario-zitadel-1',
        email: 'existente@duoc.cl',
        displayName: null,
      });

      const resultado = await service.asignarProfesionalAft(
        'zitadel-org-1',
        { email: 'existente@duoc.cl' },
        'op-directivo-1',
        'correlation-1',
      );

      expect(resultado).toEqual({ creado: false, passwordInicial: null });
      expect(zitadelAdminService.buscarUsuarioPorEmail).toHaveBeenCalledWith(
        'existente@duoc.cl',
        'correlation-1',
      );
      expect(zitadelAdminService.crearUsuarioHuman).not.toHaveBeenCalled();
      expect(zitadelAdminService.crearGrant).toHaveBeenCalledWith(
        'zitadel-org-1',
        'usuario-zitadel-1',
        'administrador-patrimonial',
        'correlation-1',
      );
    });

    // Gap 3 (flujo real Admin->Directivo->Profesional AFT) — antes esto lanzaba 404.
    it('si el email no corresponde a ningun usuario, crea el usuario en Zitadel y le asigna el rol', async () => {
      zitadelAdminService.buscarUsuarioPorEmail.mockResolvedValue(null);
      zitadelAdminService.crearUsuarioHuman.mockResolvedValue({
        userId: 'usuario-zitadel-nuevo',
        passwordInicial: 'Xy9!abcdEFGH12345678',
      });

      const resultado = await service.asignarProfesionalAft(
        'zitadel-org-1',
        { email: 'nuevo@duoc.cl' },
        'op-directivo-1',
        'correlation-1',
      );

      expect(resultado).toEqual({
        creado: true,
        passwordInicial: 'Xy9!abcdEFGH12345678',
      });
      expect(zitadelAdminService.crearUsuarioHuman).toHaveBeenCalledWith(
        'nuevo@duoc.cl',
        'correlation-1',
      );
      expect(zitadelAdminService.crearGrant).toHaveBeenCalledWith(
        'zitadel-org-1',
        'usuario-zitadel-nuevo',
        'administrador-patrimonial',
        'correlation-1',
      );
    });

    // DOC-024 3 — esta operacion nunca toca CORE, asi que sin este wrapper quedaba fuera del
    // Motor de Auditoria por completo.
    it('envuelve la operacion en AuditoriaIdentidadService.ejecutar con el operador y la organizacion (DOC-024 3)', async () => {
      zitadelAdminService.buscarUsuarioPorEmail.mockResolvedValue({
        id: 'usuario-zitadel-1',
        email: 'existente@duoc.cl',
        displayName: null,
      });

      await service.asignarProfesionalAft(
        'zitadel-org-1',
        { email: 'existente@duoc.cl' },
        'op-directivo-1',
        'correlation-1',
      );

      expect(auditoriaIdentidad.ejecutar).toHaveBeenCalledWith(
        'POST /directivo/usuarios',
        'op-directivo-1',
        'correlation-1',
        expect.any(Function),
        { organizacionId: 'zitadel-org-1' },
      );
    });
  });
});
