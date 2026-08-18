/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { CatalogoTipoActivoController } from './catalogo-tipo-activo.controller';
import { CatalogoTipoActivoRepository } from './catalogo-tipo-activo.repository';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { CatalogoTipoActivo } from './catalogo-tipo-activo.types';

describe('CatalogoTipoActivoController', () => {
  let controller: CatalogoTipoActivoController;
  let repository: jest.Mocked<CatalogoTipoActivoRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogoTipoActivoController],
      providers: [
        {
          provide: CatalogoTipoActivoRepository,
          useValue: { listar: jest.fn() },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CatalogoTipoActivoController);
    repository = module.get(CatalogoTipoActivoRepository);
  });

  it('listar delega en CatalogoTipoActivoRepository.listar', async () => {
    const tipos: CatalogoTipoActivo[] = [
      {
        id: 'catalogo-notebook',
        tipo: 'Equipo Computacional',
        familia: 'Informática',
        subfamilia: null,
        marca: null,
        modelo: null,
        fabricante: null,
        vidaUtilMeses: null,
        criticidad: 'alta',
        tecnologiaIdentificacion: 'qr',
      },
    ];
    repository.listar.mockResolvedValue(tipos);

    await expect(controller.listar()).resolves.toBe(tipos);
    expect(repository.listar).toHaveBeenCalled();
  });
});
