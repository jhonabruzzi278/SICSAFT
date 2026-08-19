import { NotFoundException } from '@nestjs/common';
import { DirectivoService } from './directivo.service';
import type { ZitadelAdminService } from '../zitadel-admin/zitadel-admin.service';
import type { GrantUsuario } from '../zitadel-admin/zitadel-admin.types';

describe('DirectivoService', () => {
  let zitadelAdminService: {
    buscarUsuarioPorEmail: jest.Mock;
    listarGrants: jest.Mock;
    crearGrant: jest.Mock;
  };
  let service: DirectivoService;

  beforeEach(() => {
    zitadelAdminService = {
      buscarUsuarioPorEmail: jest.fn(),
      listarGrants: jest.fn(),
      crearGrant: jest.fn(),
    };
    service = new DirectivoService(
      zitadelAdminService as unknown as ZitadelAdminService,
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
    it('busca el usuario por email y le asigna el rol administrador-patrimonial', async () => {
      zitadelAdminService.buscarUsuarioPorEmail.mockResolvedValue({
        id: 'usuario-zitadel-1',
        email: 'nuevo@duoc.cl',
        displayName: null,
      });

      await service.asignarProfesionalAft(
        'zitadel-org-1',
        { email: 'nuevo@duoc.cl' },
        'correlation-1',
      );

      expect(zitadelAdminService.buscarUsuarioPorEmail).toHaveBeenCalledWith(
        'nuevo@duoc.cl',
        'correlation-1',
      );
      expect(zitadelAdminService.crearGrant).toHaveBeenCalledWith(
        'zitadel-org-1',
        'usuario-zitadel-1',
        'administrador-patrimonial',
        'correlation-1',
      );
    });

    it('lanza 404 si el email no corresponde a ningun usuario de Zitadel', async () => {
      zitadelAdminService.buscarUsuarioPorEmail.mockResolvedValue(null);

      await expect(
        service.asignarProfesionalAft(
          'zitadel-org-1',
          { email: 'no-existe@duoc.cl' },
          'correlation-1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(zitadelAdminService.crearGrant).not.toHaveBeenCalled();
    });
  });
});
