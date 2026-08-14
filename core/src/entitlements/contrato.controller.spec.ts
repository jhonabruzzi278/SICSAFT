/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { ContratoController } from './contrato.controller';
import { ContratoRepository } from './contrato.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { Contrato, ContratosPagina } from './contrato.types';

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
const PAGINA: ContratosPagina = { contratos: CONTRATOS, total: 1 };

describe('ContratoController', () => {
  let controller: ContratoController;
  let contratoRepository: jest.Mocked<ContratoRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContratoController],
      providers: [
        {
          provide: ContratoRepository,
          useValue: { findPagina: jest.fn() },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ContratoController);
    contratoRepository = module.get(ContratoRepository);
  });

  it('getContratos delega en ContratoRepository.findPagina con limit/offset', async () => {
    contratoRepository.findPagina.mockResolvedValue(PAGINA);

    await expect(
      controller.getContratos({ limit: 20, offset: 0 }),
    ).resolves.toBe(PAGINA);
    expect(contratoRepository.findPagina).toHaveBeenCalledWith(20, 0);
  });
});
