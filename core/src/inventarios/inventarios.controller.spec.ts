/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`. */
import { Test, TestingModule } from '@nestjs/testing';
import { InventariosController } from './inventarios.controller';
import { InventariosService } from './inventarios.service';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import type { InventarioRequestBody } from './inventarios.schemas';
import type {
  InventarioEstadoResponse,
  PostInventarioResponse,
} from './inventarios.types';

describe('InventariosController', () => {
  let controller: InventariosController;
  let orquestadorService: jest.Mocked<OrquestadorService>;
  let inventariosService: jest.Mocked<InventariosService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventariosController],
      providers: [
        {
          provide: OrquestadorService,
          useValue: { procesarInventario: jest.fn() },
        },
        {
          provide: InventariosService,
          useValue: {
            obtenerEstado: jest.fn(),
            listarSesiones: jest.fn(),
            obtenerDetalle: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ServiceTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(InventariosController);
    orquestadorService = module.get(OrquestadorService);
    inventariosService = module.get(InventariosService);
  });

  it('postInventario delega en OrquestadorService con el correlationId de la request', async () => {
    const expected: PostInventarioResponse = {
      inventarioId: 'sesion-1',
      estado: 'recibido',
    };
    orquestadorService.procesarInventario.mockResolvedValue(expected);

    const body = {
      correlationId: 'corr-negocio',
      idempotencyKey: 'idem-1',
      operadorId: 'op-1',
      organizacionId: 'duoc-uc',
      areaId: 'area-biblioteca',
      ubicacionId: 'ubicacion-biblioteca-101',
      fechaInicio: '2026-01-15T10:00:00.000Z',
      fechaCierre: '2026-01-15T10:30:00.000Z',
      escaneos: [],
      incidencias: [],
    } as InventarioRequestBody;
    const request = {
      correlationId: 'x-corr-http',
    } as RequestWithCorrelationId;

    await expect(controller.postInventario(body, request)).resolves.toBe(
      expected,
    );
    expect(orquestadorService.procesarInventario).toHaveBeenCalledWith(
      body,
      'x-corr-http',
    );
  });

  it('getInventarioEstado delega en InventariosService con el inventarioId', async () => {
    const expected: InventarioEstadoResponse = {
      estado: 'recibido',
      ultimoIntento: '2026-01-15T10:30:00.000Z',
    };
    inventariosService.obtenerEstado.mockResolvedValue(expected);

    await expect(
      controller.getInventarioEstado({ inventarioId: 'sesion-1' }),
    ).resolves.toBe(expected);
    expect(inventariosService.obtenerEstado).toHaveBeenCalledWith('sesion-1');
  });

  it('getInventarios delega en InventariosService con organizacionId', async () => {
    const expected = [
      {
        id: 'sesion-1',
        organizacionId: 'duoc-uc',
        areaId: 'area-biblioteca',
        ubicacionId: 'ubicacion-biblioteca-101',
        operadorId: 'op-1',
        fechaInicio: '2026-01-15T10:00:00.000Z',
        fechaCierre: '2026-01-15T10:30:00.000Z',
        estado: 'recibido' as const,
        creadoEn: '2026-01-15T10:30:05.000Z',
      },
    ];
    inventariosService.listarSesiones.mockResolvedValue(expected);

    await expect(
      controller.getInventarios({ organizacionId: 'duoc-uc' }),
    ).resolves.toBe(expected);
    expect(inventariosService.listarSesiones).toHaveBeenCalledWith('duoc-uc');
  });

  it('getInventarioDetalle delega en InventariosService con el id', async () => {
    const expected = {
      id: 'sesion-1',
      organizacionId: 'duoc-uc',
      areaId: 'area-biblioteca',
      ubicacionId: 'ubicacion-biblioteca-101',
      operadorId: 'op-1',
      fechaInicio: '2026-01-15T10:00:00.000Z',
      fechaCierre: '2026-01-15T10:30:00.000Z',
      estado: 'recibido' as const,
      creadoEn: '2026-01-15T10:30:05.000Z',
      escaneos: [],
    };
    inventariosService.obtenerDetalle.mockResolvedValue(expected);

    await expect(
      controller.getInventarioDetalle({ id: 'sesion-1' }),
    ).resolves.toBe(expected);
    expect(inventariosService.obtenerDetalle).toHaveBeenCalledWith('sesion-1');
  });
});
