/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { ContratoController } from './contrato.controller';
import { ContratoRepository } from './contrato.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { Contrato } from './contrato.types';

const CONTRATOS: Contrato[] = [
  {
    id: 'contrato-1',
    organizacionId: 'duoc-uc',
    organizacionNombre: 'DUOC UC',
    sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
    vigenciaDesde: '2026-01-01T00:00:00.000Z',
    vigenciaHasta: null,
    estado: 'vigente',
    modulosContratados: ['inventario-qr'],
  },
];

describe('ContratoController', () => {
  let controller: ContratoController;
  let contratoRepository: jest.Mocked<ContratoRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContratoController],
      providers: [
        {
          provide: ContratoRepository,
          useValue: { findAll: jest.fn() },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ContratoController);
    contratoRepository = module.get(ContratoRepository);
  });

  it('getContratos delega en ContratoRepository.findAll', async () => {
    contratoRepository.findAll.mockResolvedValue(CONTRATOS);

    await expect(controller.getContratos()).resolves.toBe(CONTRATOS);
    expect(contratoRepository.findAll).toHaveBeenCalled();
  });
});
