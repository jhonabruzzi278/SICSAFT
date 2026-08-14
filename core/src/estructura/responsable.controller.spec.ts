/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { ResponsableController } from './responsable.controller';
import { ResponsableRepository } from './responsable.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { Responsable, ResponsablesPagina } from './responsable.types';

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
const PAGINA: ResponsablesPagina = { responsables: RESPONSABLES, total: 1 };

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

  it('getResponsables delega en ResponsableRepository.findByArea con limit/offset', async () => {
    responsableRepository.findByArea.mockResolvedValue(PAGINA);

    await expect(
      controller.getResponsables({ areaId: 'area-1', limit: 20, offset: 0 }),
    ).resolves.toBe(PAGINA);
    expect(responsableRepository.findByArea).toHaveBeenCalledWith(
      'area-1',
      20,
      0,
    );
  });
});
