/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { IndicadoresController } from './indicadores.controller';
import { IndicadoresRepository } from './indicadores.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { Indicadores } from './indicadores.types';

describe('IndicadoresController', () => {
  let controller: IndicadoresController;
  let repository: jest.Mocked<IndicadoresRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IndicadoresController],
      providers: [
        {
          provide: IndicadoresRepository,
          useValue: { obtener: jest.fn() },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(IndicadoresController);
    repository = module.get(IndicadoresRepository);
  });

  it('obtener delega en IndicadoresRepository.obtener', async () => {
    const indicadores: Indicadores = {
      totalOrganizaciones: 3,
      totalSedes: 5,
      contratosPorEstado: {
        vigente: 2,
        suspendido: 1,
        vencido: 0,
        cancelado: 0,
      },
    };
    repository.obtener.mockResolvedValue(indicadores);

    await expect(controller.obtener()).resolves.toBe(indicadores);
    expect(repository.obtener).toHaveBeenCalled();
  });
});
