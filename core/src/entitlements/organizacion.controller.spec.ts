/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizacionController } from './organizacion.controller';
import { OrganizacionRepository } from './organizacion.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { Organizacion } from './organizacion.types';

describe('OrganizacionController', () => {
  let controller: OrganizacionController;
  let repository: jest.Mocked<OrganizacionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizacionController],
      providers: [
        {
          provide: OrganizacionRepository,
          useValue: { listar: jest.fn() },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(OrganizacionController);
    repository = module.get(OrganizacionRepository);
  });

  it('listar delega en OrganizacionRepository.listar', async () => {
    const organizaciones: Organizacion[] = [
      { id: 'duoc-uc', nombre: 'DUOC UC', estado: 'activo' },
    ];
    repository.listar.mockResolvedValue(organizaciones);

    await expect(controller.listar()).resolves.toBe(organizaciones);
    expect(repository.listar).toHaveBeenCalled();
  });
});
