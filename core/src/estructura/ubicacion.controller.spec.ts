/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { UbicacionController } from './ubicacion.controller';
import { UbicacionRepository } from './ubicacion.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { Ubicacion, UbicacionesPagina } from './ubicacion.types';

const UBICACIONES: Ubicacion[] = [
  {
    id: 'ubicacion-1',
    sedeId: 'melipilla',
    edificio: null,
    piso: null,
    areaId: null,
    oficina: null,
    dependencia: null,
  },
];
const PAGINA: UbicacionesPagina = { ubicaciones: UBICACIONES, total: 1 };

describe('UbicacionController', () => {
  let controller: UbicacionController;
  let ubicacionRepository: jest.Mocked<UbicacionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UbicacionController],
      providers: [
        { provide: UbicacionRepository, useValue: { findBySede: jest.fn() } },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(UbicacionController);
    ubicacionRepository = module.get(UbicacionRepository);
  });

  it('getUbicaciones delega en UbicacionRepository.findBySede con limit/offset', async () => {
    ubicacionRepository.findBySede.mockResolvedValue(PAGINA);

    await expect(
      controller.getUbicaciones({ sedeId: 'melipilla', limit: 20, offset: 0 }),
    ).resolves.toBe(PAGINA);
    expect(ubicacionRepository.findBySede).toHaveBeenCalledWith(
      'melipilla',
      20,
      0,
    );
  });
});
