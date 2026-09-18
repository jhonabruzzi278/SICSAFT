/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { AuditoriaAdminController } from './administrador-auditoria.controller';
import { AdministradorService } from './administrador.service';
import { KeycloakAuthGuard } from '../common/auth/keycloak-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { AuditoriaEntradaResult } from '../core-client/core-client.types';
import {
  CORRELATION_ID,
  correlationRequest,
} from './administrador-test-helpers';

describe('AuditoriaAdminController', () => {
  let controller: AuditoriaAdminController;
  let service: jest.Mocked<AdministradorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditoriaAdminController],
      providers: [
        {
          provide: AdministradorService,
          useValue: {
            getAuditoria: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(KeycloakAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuditoriaAdminController);
    service = module.get(AdministradorService);
  });

  it('getAuditoria delega en el service con la query y el correlationId', async () => {
    const entradas: AuditoriaEntradaResult[] = [
      {
        id: 'audit-1',
        usuario: 'op-1',
        fecha: '2026-08-14T10:00:00.000Z',
        equipo: null,
        ip: null,
        operacion: 'POST /inventarios',
        resultado: 'recibido',
        observaciones: null,
        areaOperativa: 'area-biblioteca',
      },
    ];
    const pagina = { entradas, total: entradas.length };
    service.getAuditoria.mockResolvedValue(pagina);
    const request = correlationRequest();
    const query = {
      usuario: 'op-1',
      operacion: 'baja',
      limit: 20,
      offset: 0,
    };

    await expect(controller.getAuditoria(query, request)).resolves.toEqual(
      pagina,
    );
    expect(service.getAuditoria).toHaveBeenCalledWith(query, CORRELATION_ID);
  });
});
