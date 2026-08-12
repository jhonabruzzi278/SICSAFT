/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`, la regla
   solo tiene falsos positivos al referenciar un metodo mockeado sin invocarlo dentro de expect(). */
import { Test, TestingModule } from '@nestjs/testing';
import { QrConnectorController } from './qr-connector.controller';
import { QrConnectorService } from './qr-connector.service';
import {
  AuthSessionResponse,
  CatalogoResponse,
  InventarioEstadoResponse,
  PostInventarioResponse,
} from './qr-connector.types';

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
          },
        },
      ],
    }).compile();

    controller = module.get(QrConnectorController);
    service = module.get(QrConnectorService);
  });

  it('authSession delega en el service', () => {
    const expected: AuthSessionResponse = {
      accessToken: 't',
      expiresAt: 'e',
      organizaciones: [],
    };
    service.authSession.mockReturnValue(expected);

    const body = { operadorId: 'op-1', credencial: 'x', deviceId: 'd-1' };
    expect(controller.authSession(body)).toBe(expected);
    expect(service.authSession).toHaveBeenCalledWith(body);
  });

  it('getCatalogo delega en el service', () => {
    const expected: CatalogoResponse = { activos: [] };
    service.getCatalogo.mockReturnValue(expected);

    const query = { organizacionId: 'duoc-uc' };
    expect(controller.getCatalogo(query)).toBe(expected);
    expect(service.getCatalogo).toHaveBeenCalledWith(query);
  });

  it('postInventario delega en el service', () => {
    const expected: PostInventarioResponse = {
      inventarioId: 'inv-1',
      estado: 'recibido',
    };
    service.postInventario.mockReturnValue(expected);

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
    expect(controller.postInventario(body)).toBe(expected);
    expect(service.postInventario).toHaveBeenCalledWith(body);
  });

  it('getInventarioEstado delega en el service', () => {
    const expected: InventarioEstadoResponse = {
      estado: 'recibido',
      ultimoIntento: 't',
    };
    service.getInventarioEstado.mockReturnValue(expected);

    expect(controller.getInventarioEstado('inv-1')).toBe(expected);
    expect(service.getInventarioEstado).toHaveBeenCalledWith('inv-1');
  });
});
