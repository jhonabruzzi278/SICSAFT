/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { DirectivoController } from './directivo.controller';
import { DirectivoService } from './directivo.service';
import { DirectivoGuard, type DirectivoRequest } from './directivo.guard';
import { ZitadelAuthGuard } from '../common/auth/zitadel-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import type { GrantUsuario } from '../zitadel-admin/zitadel-admin.types';

const CORRELATION_ID = 'correlation-test';

function buildDirectivoRequest(): DirectivoRequest & RequestWithCorrelationId {
  return {
    directivoOrganizacionId: 'zitadel-org-1',
    correlationId: CORRELATION_ID,
    auth: {
      operadorId: 'op-directivo-1',
      accessToken: 'token-1',
      expiresAt: '2026-01-01T00:00:00.000Z',
      rolesPorOrganizacion: { 'zitadel-org-1': ['directivo'] },
    },
  } as unknown as DirectivoRequest & RequestWithCorrelationId & Request;
}

describe('DirectivoController', () => {
  let controller: DirectivoController;
  let service: jest.Mocked<DirectivoService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DirectivoController],
      providers: [
        {
          provide: DirectivoService,
          useValue: {
            listarUsuariosOrganizacion: jest.fn(),
            asignarProfesionalAft: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ZitadelAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(DirectivoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(DirectivoController);
    service = module.get(DirectivoService);
  });

  it('getUsuarios delega en el service con el organizacionId que fijó DirectivoGuard y el correlationId', async () => {
    const grants: GrantUsuario[] = [
      {
        userId: 'usuario-1',
        email: 'usuario@duoc.cl',
        displayName: 'Usuario Uno',
        roles: ['administrador-patrimonial'],
      },
    ];
    service.listarUsuariosOrganizacion.mockResolvedValue(grants);
    const request = buildDirectivoRequest();

    await expect(controller.getUsuarios(request)).resolves.toEqual(grants);
    expect(service.listarUsuariosOrganizacion).toHaveBeenCalledWith(
      'zitadel-org-1',
      CORRELATION_ID,
    );
  });

  it('asignarProfesionalAft delega en el service con el organizacionId que fijó DirectivoGuard, el body y el correlationId', async () => {
    const resultado = { creado: true, passwordInicial: 'Xy9!abcdEFGH12345678' };
    service.asignarProfesionalAft.mockResolvedValue(resultado);
    const body = { email: 'nuevo@duoc.cl' };
    const request = buildDirectivoRequest();

    await expect(controller.asignarProfesionalAft(body, request)).resolves.toBe(
      resultado,
    );
    expect(service.asignarProfesionalAft).toHaveBeenCalledWith(
      'zitadel-org-1',
      body,
      'op-directivo-1',
      CORRELATION_ID,
    );
  });
});
