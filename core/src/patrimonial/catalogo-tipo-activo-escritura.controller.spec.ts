/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { CatalogoTipoActivoEscrituraController } from './catalogo-tipo-activo-escritura.controller';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { AltaCatalogoTipoBody } from './catalogo-tipo-activo.schemas';
import type { CatalogoTipoActivo } from './catalogo-tipo-activo.types';

describe('CatalogoTipoActivoEscrituraController', () => {
  let controller: CatalogoTipoActivoEscrituraController;
  let orquestadorService: jest.Mocked<OrquestadorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogoTipoActivoEscrituraController],
      providers: [
        {
          provide: OrquestadorService,
          useValue: { procesarAltaCatalogoTipo: jest.fn() },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CatalogoTipoActivoEscrituraController);
    orquestadorService = module.get(OrquestadorService);
  });

  it('crear delega en OrquestadorService.procesarAltaCatalogoTipo con el body', async () => {
    const tipo: CatalogoTipoActivo = {
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
    };
    orquestadorService.procesarAltaCatalogoTipo.mockResolvedValue(tipo);
    const body = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      tipo: 'Equipo Computacional',
      familia: 'Informática',
      criticidad: 'alta',
      tecnologiaIdentificacion: 'qr',
    } as AltaCatalogoTipoBody;

    await expect(controller.crear(body)).resolves.toBe(tipo);
    expect(orquestadorService.procesarAltaCatalogoTipo).toHaveBeenCalledWith(
      body,
    );
  });
});
