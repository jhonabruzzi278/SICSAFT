/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ImportacionContableLoteController } from './importacion-contable-lote.controller';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type {
  AprobarLoteBody,
  CrearLoteBody,
  RechazarLoteBody,
} from './importacion-contable-lote.schemas';

const IDENTIDAD = {
  correlationId: 'corr-1',
  operadorId: 'op-admin',
  organizacionId: 'muni',
  rolesPorOrganizacion: { muni: ['administrador-patrimonial'] },
};

describe('ImportacionContableLoteController', () => {
  let controller: ImportacionContableLoteController;
  let orquestadorService: jest.Mocked<OrquestadorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportacionContableLoteController],
      providers: [
        {
          provide: OrquestadorService,
          useValue: {
            crearLoteImportacionContable: jest.fn(),
            listarLotesImportacionContable: jest.fn(),
            obtenerLoteImportacionContable: jest.fn(),
            aprobarLoteImportacionContable: jest.fn(),
            rechazarLoteImportacionContable: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ImportacionContableLoteController);
    orquestadorService = module.get(OrquestadorService);
  });

  it('crearLote delega el body en OrquestadorService', async () => {
    orquestadorService.crearLoteImportacionContable.mockResolvedValue({
      loteId: 'lote-1',
      resumen: { totalFilas: 1, crear: 1, yaImportado: 0, conflicto: 0 },
    });
    const body = {
      ...IDENTIDAD,
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
    } as CrearLoteBody;

    await expect(controller.crearLote(body)).resolves.toEqual({
      loteId: 'lote-1',
      resumen: { totalFilas: 1, crear: 1, yaImportado: 0, conflicto: 0 },
    });
    expect(
      orquestadorService.crearLoteImportacionContable,
    ).toHaveBeenCalledWith(body);
  });

  describe('listarLotes', () => {
    it('sin organizacionId tira BadRequest', () => {
      expect(() => controller.listarLotes(undefined)).toThrow(
        BadRequestException,
      );
    });

    it('con estado inválido tira BadRequest', () => {
      expect(() => controller.listarLotes('muni', 'raro')).toThrow(
        BadRequestException,
      );
    });

    it('con parámetros válidos delega (con y sin estado)', async () => {
      orquestadorService.listarLotesImportacionContable.mockResolvedValue([]);
      await controller.listarLotes('muni');
      await controller.listarLotes('muni', 'pendiente_revision');
      expect(
        orquestadorService.listarLotesImportacionContable,
      ).toHaveBeenNthCalledWith(1, 'muni', undefined);
      expect(
        orquestadorService.listarLotesImportacionContable,
      ).toHaveBeenNthCalledWith(2, 'muni', 'pendiente_revision');
    });
  });

  it('obtenerLote delega el id', async () => {
    await controller.obtenerLote('lote-1');
    expect(
      orquestadorService.obtenerLoteImportacionContable,
    ).toHaveBeenCalledWith('lote-1');
  });

  it('aprobarLote delega id + body', async () => {
    const body = { ...IDENTIDAD } as AprobarLoteBody;
    await controller.aprobarLote('lote-1', body);
    expect(
      orquestadorService.aprobarLoteImportacionContable,
    ).toHaveBeenCalledWith('lote-1', body);
  });

  it('rechazarLote delega id + body', async () => {
    const body = { ...IDENTIDAD, motivo: 'no cuadra' } as RechazarLoteBody;
    await controller.rechazarLote('lote-1', body);
    expect(
      orquestadorService.rechazarLoteImportacionContable,
    ).toHaveBeenCalledWith('lote-1', body);
  });
});
