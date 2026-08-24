/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { SedeController } from './sede.controller';
import { SedeRepository } from './sede.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { Sede } from './sede.types';

describe('SedeController', () => {
  let controller: SedeController;
  let repository: jest.Mocked<SedeRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SedeController],
      providers: [
        {
          provide: SedeRepository,
          useValue: { listarPorOrganizacion: jest.fn() },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SedeController);
    repository = module.get(SedeRepository);
  });

  it('listar delega en SedeRepository.listarPorOrganizacion con el organizacionId de la query (DOC-024 1)', async () => {
    const sedes: Sede[] = [
      {
        id: 'melipilla',
        organizacionId: 'duoc-uc',
        nombre: 'Melipilla',
        estado: 'activo',
      },
    ];
    repository.listarPorOrganizacion.mockResolvedValue(sedes);

    await expect(
      controller.listar({ organizacionId: 'duoc-uc' }),
    ).resolves.toBe(sedes);
    expect(repository.listarPorOrganizacion).toHaveBeenCalledWith('duoc-uc');
  });
});
