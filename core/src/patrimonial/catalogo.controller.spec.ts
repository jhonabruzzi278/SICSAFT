/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`, la regla
   solo tiene falsos positivos al referenciar un metodo mockeado sin invocarlo dentro de expect(). */
import { Test, TestingModule } from '@nestjs/testing';
import { CatalogoController } from './catalogo.controller';
import { ActivoRepository } from './activo.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { CatalogoPagina } from './activo.types';

describe('CatalogoController', () => {
  let controller: CatalogoController;
  let repository: jest.Mocked<ActivoRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogoController],
      providers: [
        {
          provide: ActivoRepository,
          useValue: { findCatalogo: jest.fn() },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CatalogoController);
    repository = module.get(ActivoRepository);
  });

  it('getCatalogo delega en el repository con el filtro completo', async () => {
    const expected: CatalogoPagina = { activos: [], total: 0 };
    repository.findCatalogo.mockResolvedValue(expected);

    const query = {
      organizacionId: 'duoc-uc',
      areaId: 'area-biblioteca',
      ubicacionId: 'ubicacion-biblioteca-101',
      limit: 20,
      offset: 0,
    };

    await expect(controller.getCatalogo(query)).resolves.toBe(expected);
    expect(repository.findCatalogo).toHaveBeenCalledWith(query);
  });
});
