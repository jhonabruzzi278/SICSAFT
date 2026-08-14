/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`, la regla
   solo tiene falsos positivos al referenciar un metodo mockeado sin invocarlo dentro de expect(). */
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { QrConnectorController } from './qr-connector.controller';
import { QrConnectorService } from './qr-connector.service';
import {
  ZitadelAuthGuard,
  type AuthenticatedRequest,
  type ZitadelAuthContext,
} from '../common/auth/zitadel-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import {
  AuthSessionResponse,
  CatalogoResponse,
  InventarioEstadoResponse,
  PostInventarioResponse,
} from './qr-connector.types';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';

const CORRELATION_ID = 'correlation-test';

function buildAuthenticatedRequest(
  auth: ZitadelAuthContext,
): AuthenticatedRequest & RequestWithCorrelationId {
  return { auth, correlationId: CORRELATION_ID } as AuthenticatedRequest &
    RequestWithCorrelationId &
    Request;
}

describe('QrConnectorController', () => {
  let controller: QrConnectorController;
  let service: jest.Mocked<QrConnectorService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QrConnectorController],
      providers: [
        {
          provide: QrConnectorService,
          useValue: {
            authSession: jest.fn(),
            getCatalogo: jest.fn(),
            postInventario: jest.fn(),
            getInventarioEstado: jest.fn(),
            getInventarios: jest.fn(),
            getInventarioDetalle: jest.fn(),
          },
        },
      ],
    })
      // El controller no ejecuta los guards en estos tests (se llaman los metodos directo, sin
      // HTTP) — se sobreescriben igual porque Nest resuelve sus dependencias al armar el modulo
      // aunque nunca corra canActivate (ZitadelAuthGuard necesita JWKS/config, RateLimitGuard
      // necesita un cliente Redis).
      .overrideGuard(ZitadelAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(QrConnectorController);
    service = module.get(QrConnectorService);
  });

  it('authSession delega en el service con el contexto de auth del guard', async () => {
    const expected: AuthSessionResponse = {
      accessToken: 't',
      expiresAt: 'e',
      organizaciones: [],
    };
    service.authSession.mockResolvedValue(expected);

    const body = { deviceId: 'd-1' };
    const auth: ZitadelAuthContext = {
      operadorId: 'op-1',
      accessToken: 'zitadel-token',
      expiresAt: '2026-08-12T10:15:00.000Z',
      rolesPorOrganizacion: {},
    };
    const request = buildAuthenticatedRequest(auth);

    await expect(controller.authSession(body, request)).resolves.toBe(expected);
    expect(service.authSession).toHaveBeenCalledWith(
      body,
      auth,
      CORRELATION_ID,
    );
  });

  it('authSession lanza 401 si el guard no seteo el contexto de auth', () => {
    const request = {} as AuthenticatedRequest & RequestWithCorrelationId;
    expect(() => controller.authSession({ deviceId: 'd-1' }, request)).toThrow(
      'No hay contexto de autenticación',
    );
  });

  it('getCatalogo delega en el service con el correlationId de la request', async () => {
    const expected: CatalogoResponse = { activos: [] };
    service.getCatalogo.mockResolvedValue(expected);

    const query = { organizacionId: 'duoc-uc' };
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;
    await expect(controller.getCatalogo(query, request)).resolves.toBe(
      expected,
    );
    expect(service.getCatalogo).toHaveBeenCalledWith(query, CORRELATION_ID);
  });

  it('postInventario delega en el service con el correlationId de la request', async () => {
    const expected: PostInventarioResponse = {
      inventarioId: 'inv-1',
      estado: 'recibido',
    };
    service.postInventario.mockResolvedValue(expected);

    const body = {
      correlationId: 'c',
      idempotencyKey: 'k',
      operadorId: 'op-1',
      organizacionId: 'duoc-uc',
      areaId: 'a',
      ubicacionId: 'u',
      fechaInicio: 'x',
      fechaCierre: 'y',
      escaneos: [],
      incidencias: [],
    };
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;
    await expect(controller.postInventario(body, request)).resolves.toBe(
      expected,
    );
    expect(service.postInventario).toHaveBeenCalledWith(body, CORRELATION_ID);
  });

  it('getInventarioEstado delega en el service con el correlationId de la request', async () => {
    const expected: InventarioEstadoResponse = {
      estado: 'recibido',
      ultimoIntento: 't',
    };
    service.getInventarioEstado.mockResolvedValue(expected);

    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;
    await expect(
      controller.getInventarioEstado('inv-1', request),
    ).resolves.toBe(expected);
    expect(service.getInventarioEstado).toHaveBeenCalledWith(
      'inv-1',
      CORRELATION_ID,
    );
  });

  it('getInventarios delega en el service con la query y el correlationId de la request', async () => {
    const expected = [
      {
        id: 'sesion-1',
        organizacionId: 'duoc-uc',
        areaId: 'laboratorio-informatica',
        ubicacionId: 'melipilla',
        operadorId: 'op-1',
        fechaInicio: '2026-08-12T10:00:00.000Z',
        fechaCierre: '2026-08-12T11:00:00.000Z',
        estado: 'recibido' as const,
        creadoEn: '2026-08-12T11:00:05.000Z',
      },
    ];
    service.getInventarios.mockResolvedValue(expected);

    const query = { organizacionId: 'duoc-uc' };
    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;
    await expect(controller.getInventarios(query, request)).resolves.toBe(
      expected,
    );
    expect(service.getInventarios).toHaveBeenCalledWith(
      'duoc-uc',
      CORRELATION_ID,
    );
  });

  it('getInventarioDetalle delega en el service con el id y el correlationId de la request', async () => {
    const expected = {
      id: 'sesion-1',
      organizacionId: 'duoc-uc',
      areaId: 'laboratorio-informatica',
      ubicacionId: 'melipilla',
      operadorId: 'op-1',
      fechaInicio: '2026-08-12T10:00:00.000Z',
      fechaCierre: '2026-08-12T11:00:00.000Z',
      estado: 'recibido' as const,
      creadoEn: '2026-08-12T11:00:05.000Z',
      escaneos: [],
    };
    service.getInventarioDetalle.mockResolvedValue(expected);

    const request = {
      correlationId: CORRELATION_ID,
    } as RequestWithCorrelationId;
    await expect(
      controller.getInventarioDetalle('sesion-1', request),
    ).resolves.toBe(expected);
    expect(service.getInventarioDetalle).toHaveBeenCalledWith(
      'sesion-1',
      CORRELATION_ID,
    );
  });
});
