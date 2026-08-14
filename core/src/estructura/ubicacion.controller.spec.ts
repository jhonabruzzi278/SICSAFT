/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { UbicacionController } from './ubicacion.controller';
import { UbicacionRepository } from './ubicacion.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { Ubicacion } from './ubicacion.types';

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

  it('getUbicaciones delega en UbicacionRepository.findBySede', async () => {
    ubicacionRepository.findBySede.mockResolvedValue(UBICACIONES);

    await expect(
      controller.getUbicaciones({ sedeId: 'melipilla' }),
    ).resolves.toBe(UBICACIONES);
    expect(ubicacionRepository.findBySede).toHaveBeenCalledWith('melipilla');
  });
});
