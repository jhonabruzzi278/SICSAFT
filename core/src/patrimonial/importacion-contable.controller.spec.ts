/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { ImportacionContableController } from './importacion-contable.controller';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { ImportacionContableBody } from './importacion-contable.schemas';
import type { ImportacionContableResultado } from './importacion-contable.types';

const RESULTADO: ImportacionContableResultado = {
  filas: [{ codigoPatrimonial: 'AFT-1', resultado: 'creado' }],
  creados: 1,
  yaImportados: 0,
  conflictos: 0,
};

describe('ImportacionContableController', () => {
  let controller: ImportacionContableController;
  let orquestadorService: jest.Mocked<OrquestadorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportacionContableController],
      providers: [
        {
          provide: OrquestadorService,
          useValue: { procesarImportacionContable: jest.fn() },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ImportacionContableController);
    orquestadorService = module.get(OrquestadorService);
  });

  it('importar delega en OrquestadorService.procesarImportacionContable con el body', async () => {
    orquestadorService.procesarImportacionContable.mockResolvedValue(RESULTADO);
    const body = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      filas: [
        {
          codigoPatrimonial: 'AFT-1',
          codigoQr: 'QR-1',
          catalogoId: 'catalogo-notebook',
        },
      ],
    } as ImportacionContableBody;

    await expect(controller.importar(body)).resolves.toBe(RESULTADO);
    expect(orquestadorService.procesarImportacionContable).toHaveBeenCalledWith(
      body,
    );
  });
});
