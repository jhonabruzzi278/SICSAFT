/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { ImportacionesAdminController } from './administrador-importaciones.controller';
import { AdministradorService } from './administrador.service';
import { KeycloakAuthGuard } from '../common/auth/keycloak-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { ImportacionContableResult } from '../core-client/core-client.types';
import type { ImportacionContableBody } from './administrador.schemas';
import {
  AUTH,
  CORRELATION_ID,
  buildAuthenticatedRequest,
  correlationRequest,
} from './administrador-test-helpers';

describe('ImportacionesAdminController', () => {
  let controller: ImportacionesAdminController;
  let service: jest.Mocked<AdministradorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportacionesAdminController],
      providers: [
        {
          provide: AdministradorService,
          useValue: {
            importarContable: jest.fn(),
            crearLoteImportacionContable: jest.fn(),
            listarLotesImportacionContable: jest.fn(),
            obtenerLoteImportacionContable: jest.fn(),
            aprobarLoteImportacionContable: jest.fn(),
            rechazarLoteImportacionContable: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(KeycloakAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ImportacionesAdminController);
    service = module.get(AdministradorService);
  });

  // DOC-012 6 (gap "importaciones controladas").
  it('importarContable delega en el service con el body, el auth del guard y el correlationId', async () => {
    const resultado: ImportacionContableResult = {
      filas: [{ codigoPatrimonial: 'AFT-1', resultado: 'creado' }],
      creados: 1,
      yaImportados: 0,
      conflictos: 0,
    };
    service.importarContable.mockResolvedValue(resultado);
    const body: ImportacionContableBody = {
      organizacionId: 'duoc-uc',
      filas: [
        {
          codigoPatrimonial: 'AFT-1',
          codigoQr: 'QR-1',
          catalogoId: 'catalogo-notebook',
        },
      ],
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.importarContable(body, request)).resolves.toBe(
      resultado,
    );
    expect(service.importarContable).toHaveBeenCalledWith(
      body,
      AUTH,
      CORRELATION_ID,
    );
  });

  // DOC-029 RF-B — bandeja de staging de la ingesta de Excel supervisada.
  describe('bandeja de staging de importación contable', () => {
    it('crearLoteImportacionContable delega body + auth + correlationId', async () => {
      const resultado = {
        loteId: 'lote-1',
        resumen: { totalFilas: 1, crear: 1, yaImportado: 0, conflicto: 0 },
      };
      service.crearLoteImportacionContable.mockResolvedValue(resultado);
      const body = {
        organizacionId: 'duoc-uc',
        origen: 'carpeta',
        archivoNombre: 'activos.xls',
        filas: [
          {
            linea: 1,
            codigoPatrimonial: 'DG-001',
            codigoQr: 'DG-001',
            catalogoId: 'cat-1',
            crudo: {},
          },
        ],
      } as Parameters<typeof controller.crearLoteImportacionContable>[0];
      const request = buildAuthenticatedRequest(AUTH);

      await expect(
        controller.crearLoteImportacionContable(body, request),
      ).resolves.toBe(resultado);
      expect(service.crearLoteImportacionContable).toHaveBeenCalledWith(
        body,
        AUTH,
        CORRELATION_ID,
      );
    });

    it('listarLotesImportacionContable delega organizacionId + estado + correlationId', async () => {
      service.listarLotesImportacionContable.mockResolvedValue([]);
      const request = correlationRequest();

      await controller.listarLotesImportacionContable(
        { organizacionId: 'duoc-uc', estado: 'pendiente_revision' },
        request,
      );

      expect(service.listarLotesImportacionContable).toHaveBeenCalledWith(
        'duoc-uc',
        'pendiente_revision',
        CORRELATION_ID,
      );
    });

    it('obtenerLoteImportacionContable delega id + correlationId', async () => {
      service.obtenerLoteImportacionContable.mockResolvedValue({
        lote: {} as never,
        filas: [],
      });
      const request = correlationRequest();

      await controller.obtenerLoteImportacionContable('lote-1', request);

      expect(service.obtenerLoteImportacionContable).toHaveBeenCalledWith(
        'lote-1',
        CORRELATION_ID,
      );
    });

    it('aprobarLoteImportacionContable delega id + body + auth + correlationId', async () => {
      service.aprobarLoteImportacionContable.mockResolvedValue({
        filas: [],
        creados: 1,
        yaImportados: 0,
        conflictos: 0,
      });
      const request = buildAuthenticatedRequest(AUTH);

      await controller.aprobarLoteImportacionContable(
        'lote-1',
        { organizacionId: 'duoc-uc' },
        request,
      );

      expect(service.aprobarLoteImportacionContable).toHaveBeenCalledWith(
        'lote-1',
        { organizacionId: 'duoc-uc' },
        AUTH,
        CORRELATION_ID,
      );
    });

    it('rechazarLoteImportacionContable delega id + body + auth + correlationId', async () => {
      service.rechazarLoteImportacionContable.mockResolvedValue({
        estado: 'rechazado',
      });
      const request = buildAuthenticatedRequest(AUTH);

      await controller.rechazarLoteImportacionContable(
        'lote-1',
        { organizacionId: 'duoc-uc', motivo: 'no cuadra' },
        request,
      );

      expect(service.rechazarLoteImportacionContable).toHaveBeenCalledWith(
        'lote-1',
        { organizacionId: 'duoc-uc', motivo: 'no cuadra' },
        AUTH,
        CORRELATION_ID,
      );
    });
  });
});
