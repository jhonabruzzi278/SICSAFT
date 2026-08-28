import { DirectivoService } from './directivo.service';
import type { AuditoriaIdentidadService } from '../auditoria-identidad/auditoria-identidad.service';
import type { KeycloakAdminService } from '../keycloak-admin/keycloak-admin.service';
import type { GrantUsuario } from '../keycloak-admin/keycloak-admin.types';

describe('DirectivoService', () => {
  let keycloakAdminService: {
    buscarUsuarioPorEmail: jest.Mock;
    listarGrants: jest.Mock;
    crearGrant: jest.Mock;
    crearUsuarioHuman: jest.Mock;
  };
  let auditoriaIdentidad: { ejecutar: jest.Mock };
  let service: DirectivoService;

  beforeEach(() => {
    keycloakAdminService = {
      buscarUsuarioPorEmail: jest.fn(),
      listarGrants: jest.fn(),
      crearGrant: jest.fn(),
      crearUsuarioHuman: jest.fn(),
    };
    // DOC-024 3 — pass-through, mismo criterio que administrador.service.spec.ts: el
    // comportamiento real del wrapper tiene su propia cobertura en
    // auditoria-identidad.service.spec.ts.
    auditoriaIdentidad = {
      ejecutar: jest.fn(
        (
          _operacion: string,
          _operadorId: string,
          _correlationId: string,
          accion: () => Promise<unknown>,
        ) => accion(),
      ),
    };
    service = new DirectivoService(
      keycloakAdminService as unknown as KeycloakAdminService,
      auditoriaIdentidad as unknown as AuditoriaIdentidadService,
    );
  });

  describe('listarUsuariosOrganizacion', () => {
    it('delega en KeycloakAdminService.listarGrants con el organizacionId recibido', async () => {
      const grants: GrantUsuario[] = [
        {
          userId: 'usuario-1',
          email: 'a@duoc.cl',
          displayName: null,
          roles: ['administrador-patrimonial'],
        },
      ];
      keycloakAdminService.listarGrants.mockResolvedValue(grants);

      const resultado = await service.listarUsuariosOrganizacion(
        'duoc-uc',
        'correlation-1',
      );

      expect(resultado).toBe(grants);
      expect(keycloakAdminService.listarGrants).toHaveBeenCalledWith(
        'duoc-uc',
        'correlation-1',
      );
    });
  });

  describe('asignarProfesionalAft', () => {
    it('si el usuario ya existe en Keycloak, solo le asigna el rol administrador-patrimonial (no crea password)', async () => {
      keycloakAdminService.buscarUsuarioPorEmail.mockResolvedValue({
        id: 'usuario-keycloak-1',
        email: 'existente@duoc.cl',
        displayName: null,
      });

      const resultado = await service.asignarProfesionalAft(
        'duoc-uc',
        { email: 'existente@duoc.cl' },
        'op-directivo-1',
        'correlation-1',
      );

      expect(resultado).toEqual({ creado: false, passwordInicial: null });
      expect(keycloakAdminService.buscarUsuarioPorEmail).toHaveBeenCalledWith(
        'existente@duoc.cl',
        'correlation-1',
      );
      expect(keycloakAdminService.crearUsuarioHuman).not.toHaveBeenCalled();
      expect(keycloakAdminService.crearGrant).toHaveBeenCalledWith(
        'duoc-uc',
        'usuario-keycloak-1',
        'administrador-patrimonial',
        'correlation-1',
      );
    });

    // Gap 3 (flujo real Admin->Directivo->Profesional AFT) — antes esto lanzaba 404.
    it('si el email no corresponde a ningun usuario, crea el usuario en Keycloak y le asigna el rol', async () => {
      keycloakAdminService.buscarUsuarioPorEmail.mockResolvedValue(null);
      keycloakAdminService.crearUsuarioHuman.mockResolvedValue({
        userId: 'usuario-keycloak-nuevo',
        passwordInicial: 'Xy9!abcdEFGH12345678',
      });

      const resultado = await service.asignarProfesionalAft(
        'duoc-uc',
        { email: 'nuevo@duoc.cl' },
        'op-directivo-1',
        'correlation-1',
      );

      expect(resultado).toEqual({
        creado: true,
        passwordInicial: 'Xy9!abcdEFGH12345678',
      });
      expect(keycloakAdminService.crearUsuarioHuman).toHaveBeenCalledWith(
        'nuevo@duoc.cl',
        'correlation-1',
      );
      expect(keycloakAdminService.crearGrant).toHaveBeenCalledWith(
        'duoc-uc',
        'usuario-keycloak-nuevo',
        'administrador-patrimonial',
        'correlation-1',
      );
    });

    // DOC-024 3 — esta operacion nunca toca CORE, asi que sin este wrapper quedaba fuera del
    // Motor de Auditoria por completo.
    it('envuelve la operacion en AuditoriaIdentidadService.ejecutar con el operador y la organizacion (DOC-024 3)', async () => {
      keycloakAdminService.buscarUsuarioPorEmail.mockResolvedValue({
        id: 'usuario-keycloak-1',
        email: 'existente@duoc.cl',
        displayName: null,
      });

      await service.asignarProfesionalAft(
        'duoc-uc',
        { email: 'existente@duoc.cl' },
        'op-directivo-1',
        'correlation-1',
      );

      expect(auditoriaIdentidad.ejecutar).toHaveBeenCalledWith(
        'POST /directivo/usuarios',
        'op-directivo-1',
        'correlation-1',
        expect.any(Function),
        { organizacionId: 'duoc-uc' },
      );
    });
  });
});
