/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { ResponsableController } from './responsable.controller';
import { ResponsableRepository } from './responsable.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { Responsable } from './responsable.types';

const RESPONSABLES: Responsable[] = [
  {
    id: 'responsable-1',
    identificacion: '11.111.111-1',
    nombre: 'Ana Soto',
    cargo: null,
    areaId: 'area-1',
    correo: null,
    telefono: null,
    estado: 'activo',
  },
];

describe('ResponsableController', () => {
  let controller: ResponsableController;
  let responsableRepository: jest.Mocked<ResponsableRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResponsableController],
      providers: [
        { provide: ResponsableRepository, useValue: { findByArea: jest.fn() } },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ResponsableController);
    responsableRepository = module.get(ResponsableRepository);
  });

  it('getResponsables delega en ResponsableRepository.findByArea', async () => {
    responsableRepository.findByArea.mockResolvedValue(RESPONSABLES);

    await expect(
      controller.getResponsables({ areaId: 'area-1' }),
    ).resolves.toBe(RESPONSABLES);
    expect(responsableRepository.findByArea).toHaveBeenCalledWith('area-1');
  });
});
