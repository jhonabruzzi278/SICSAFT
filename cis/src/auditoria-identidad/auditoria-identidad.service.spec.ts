/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { ForbiddenException } from '@nestjs/common';
import { AuditoriaIdentidadService } from './auditoria-identidad.service';
import { CoreClientService } from '../core-client/core-client.service';

function buildService() {
  const coreClientService = {
    postAuditoria: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<CoreClientService>;
  const service = new AuditoriaIdentidadService(coreClientService);
  return { service, coreClientService };
}

describe('AuditoriaIdentidadService', () => {
  describe('ejecutar', () => {
    it('ejecuta la accion, audita "ok" y devuelve el resultado (camino feliz)', async () => {
      const { service, coreClientService } = buildService();
      const accion = jest.fn().mockResolvedValue('resultado-1');

      await expect(
        service.ejecutar(
          'POST /admin/organizaciones/org-1/usuarios',
          'op-admin',
          'corr-1',
          accion,
          { organizacionId: 'org-1' },
        ),
      ).resolves.toBe('resultado-1');
      expect(accion).toHaveBeenCalled();
      expect(coreClientService.postAuditoria).toHaveBeenCalledWith(
        {
          usuario: 'op-admin',
          operacion: 'POST /admin/organizaciones/org-1/usuarios',
          resultado: 'ok',
          organizacionId: 'org-1',
        },
        'corr-1',
      );
    });

    it('funciona sin organizacionId (opciones omitidas)', async () => {
      const { service, coreClientService } = buildService();
      const accion = jest.fn().mockResolvedValue('resultado-1');

      await service.ejecutar('POST /directivo/usuarios', 'op-1', 'corr-1', accion);

      expect(coreClientService.postAuditoria).toHaveBeenCalledWith(
        {
          usuario: 'op-1',
          operacion: 'POST /directivo/usuarios',
          resultado: 'ok',
          organizacionId: undefined,
        },
        'corr-1',
      );
    });

    it('cuando la accion rechaza con un HttpException, audita "rechazado:<status>" y relanza el mismo error', async () => {
      const { service, coreClientService } = buildService();
      const error = new ForbiddenException({ message: 'sin permiso' });
      const accion = jest.fn().mockRejectedValue(error);

      await expect(
        service.ejecutar('POST /directivo/usuarios', 'op-1', 'corr-1', accion),
      ).rejects.toBe(error);
      expect(coreClientService.postAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({ resultado: 'rechazado:403' }),
        'corr-1',
      );
    });

    it('cuando la accion rechaza con un error que no es HttpException, audita "rechazado:error-interno"', async () => {
      const { service, coreClientService } = buildService();
      const error = new Error('bug inesperado');
      const accion = jest.fn().mockRejectedValue(error);

      await expect(
        service.ejecutar('POST /directivo/usuarios', 'op-1', 'corr-1', accion),
      ).rejects.toBe(error);
      expect(coreClientService.postAuditoria).toHaveBeenCalledWith(
        expect.objectContaining({ resultado: 'rechazado:error-interno' }),
        'corr-1',
      );
    });

    it('no atrapa un fallo del propio POST /auditoria — se propaga en vez de la accion ya ejecutada (DOC-024 3)', async () => {
      const { service, coreClientService } = buildService();
      const fallaAuditoria = new Error('CORE no disponible');
      coreClientService.postAuditoria.mockRejectedValue(fallaAuditoria);
      const accion = jest.fn().mockResolvedValue('resultado-1');

      await expect(
        service.ejecutar('POST /directivo/usuarios', 'op-1', 'corr-1', accion),
      ).rejects.toBe(fallaAuditoria);
    });
  });
});
