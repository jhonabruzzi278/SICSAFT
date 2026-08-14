/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { AreaController } from './area.controller';
import { AreaRepository } from './area.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { Area } from './area.types';

const AREAS: Area[] = [
  {
    id: 'area-1',
    organizacionId: 'duoc-uc',
    codigo: 'BIB',
    nombre: 'Biblioteca',
    dependencia: null,
    centroCosto: null,
    responsableId: null,
    ubicacionPrincipalId: null,
  },
];

describe('AreaController', () => {
  let controller: AreaController;
  let areaRepository: jest.Mocked<AreaRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AreaController],
      providers: [
        { provide: AreaRepository, useValue: { findByOrganizacion: jest.fn() } },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AreaController);
    areaRepository = module.get(AreaRepository);
  });

  it('getAreas delega en AreaRepository.findByOrganizacion', async () => {
    areaRepository.findByOrganizacion.mockResolvedValue(AREAS);

    await expect(
      controller.getAreas({ organizacionId: 'duoc-uc' }),
    ).resolves.toBe(AREAS);
    expect(areaRepository.findByOrganizacion).toHaveBeenCalledWith('duoc-uc');
  });
});
