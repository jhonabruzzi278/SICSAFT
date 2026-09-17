/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { CatalogoAdminController } from './administrador-catalogo.controller';
import { AdministradorService } from './administrador.service';
import { KeycloakAuthGuard } from '../common/auth/keycloak-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { CatalogoTipoResult } from '../core-client/core-client.types';
import type { AltaCatalogoTipoBody } from './administrador.schemas';
import {
  AUTH,
  CORRELATION_ID,
  buildAuthenticatedRequest,
  correlationRequest,
} from './administrador-test-helpers';

const CATALOGO_TIPO: CatalogoTipoResult = {
  id: 'catalogo-1',
  tipo: 'Equipo Computacional',
  familia: 'Informática',
  subfamilia: null,
  marca: null,
  modelo: null,
  fabricante: null,
  vidaUtilMeses: null,
  criticidad: 'media',
  tecnologiaIdentificacion: 'qr',
};

describe('CatalogoAdminController', () => {
  let controller: CatalogoAdminController;
  let service: jest.Mocked<AdministradorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogoAdminController],
      providers: [
        {
          provide: AdministradorService,
          useValue: {
            getCatalogoTipos: jest.fn(),
            altaCatalogoTipo: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(KeycloakAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CatalogoAdminController);
    service = module.get(AdministradorService);
  });

  // DOC-021 4 (gap "familias/categorías").
  it('getCatalogoTipos delega en el service con el correlationId', async () => {
    service.getCatalogoTipos.mockResolvedValue([CATALOGO_TIPO]);
    const request = correlationRequest();

    await expect(controller.getCatalogoTipos(request)).resolves.toEqual([
      CATALOGO_TIPO,
    ]);
    expect(service.getCatalogoTipos).toHaveBeenCalledWith(CORRELATION_ID);
  });

  it('altaCatalogoTipo delega en el service con el body, el auth del guard y el correlationId', async () => {
    service.altaCatalogoTipo.mockResolvedValue(CATALOGO_TIPO);
    const body: AltaCatalogoTipoBody = {
      organizacionId: 'duoc-uc',
      tipo: 'Equipo Computacional',
      familia: 'Informática',
      criticidad: 'media',
      tecnologiaIdentificacion: 'qr',
    };
    const request = buildAuthenticatedRequest(AUTH);

    await expect(controller.altaCatalogoTipo(body, request)).resolves.toBe(
      CATALOGO_TIPO,
    );
    expect(service.altaCatalogoTipo).toHaveBeenCalledWith(
      body,
      AUTH,
      CORRELATION_ID,
    );
  });
});
