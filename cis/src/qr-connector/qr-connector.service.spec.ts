import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QrConnectorService } from './qr-connector.service';
import { CatalogoQuery, InventarioRequest } from './qr-connector.schemas';
import type { ZitadelAuthContext } from '../common/auth/zitadel-auth.guard';
import type { CoreClientService } from '../core-client/core-client.service';
import type { DeviceRegistryService } from '../device-registry/device-registry.service';
import type {
  CatalogoResult,
  EntitlementsResult,
  InventarioEstadoResult,
  PostInventarioResult,
  SesionDetalleResult,
  SesionResumenResult,
} from '../core-client/core-client.types';

type CoreClientMock = jest.Mocked<
  Pick<
    CoreClientService,
    | 'getEntitlements'
    | 'getCatalogo'
    | 'postInventario'
    | 'getInventarioEstado'
    | 'getInventarios'
    | 'getInventarioDetalle'
  >
>;

function buildCoreClientService(
  overrides: {
    entitlements?: EntitlementsResult;
    catalogo?: CatalogoResult;
    postInventarioResult?: PostInventarioResult;
    inventarioEstado?: InventarioEstadoResult;
    sesiones?: SesionResumenResult[];
    sesionDetalle?: SesionDetalleResult;
  } = {},
): CoreClientMock {
  return {
    getEntitlements: jest.fn().mockResolvedValue(
      overrides.entitlements ?? {
        organizaciones: [
          {
            id: 'duoc-uc',
            nombre: 'DUOC UC',
            sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
          },
        ],
      },
    ),
    getCatalogo: jest
      .fn()
      .mockResolvedValue(overrides.catalogo ?? { activos: [], total: 0 }),
    postInventario: jest.fn().mockResolvedValue(
      overrides.postInventarioResult ?? {
        inventarioId: 'inv-1',
        estado: 'recibido',
      },
    ),
    getInventarioEstado: jest.fn().mockResolvedValue(
      overrides.inventarioEstado ?? {
        estado: 'recibido',
        ultimoIntento: '2026-08-12T10:00:00.000Z',
      },
    ),
    getInventarios: jest.fn().mockResolvedValue(overrides.sesiones ?? []),
    getInventarioDetalle: jest.fn().mockResolvedValue(
      overrides.sesionDetalle ?? {
        id: 'sesion-1',
        organizacionId: 'duoc-uc',
        areaId: 'laboratorio-informatica',
        ubicacionId: 'melipilla',
        operadorId: 'op-1',
        fechaInicio: '2026-08-12T10:00:00.000Z',
        fechaCierre: '2026-08-12T11:00:00.000Z',
        estado: 'recibido',
        creadoEn: '2026-08-12T11:00:05.000Z',
        escaneos: [],
      },
    ),
  };
}

function buildDeviceRegistryService(): jest.Mocked<
  Pick<DeviceRegistryService, 'registerDevice'>
> {
  return { registerDevice: jest.fn().mockResolvedValue(undefined) };
}

function buildAuthContext(
  overrides: Partial<ZitadelAuthContext> = {},
): ZitadelAuthContext {
  return {
    operadorId: 'op-1',
    accessToken: 'zitadel-token',
    expiresAt: '2026-08-12T10:15:00.000Z',
    rolesPorOrganizacion: {},
    ...overrides,
  };
}

function buildInventarioRequest(
  overrides: Partial<InventarioRequest> = {},
): InventarioRequest {
  return {
    correlationId: 'corr-1',
    idempotencyKey: 'idem-1',
    operadorId: 'op-1',
    organizacionId: 'duoc-uc',
    areaId: 'laboratorio-informatica',
    ubicacionId: 'melipilla',
    fechaInicio: '2026-08-12T10:00:00.000Z',
    fechaCierre: '2026-08-12T11:00:00.000Z',
    escaneos: [{ codigoQr: 'QR-0001', resultado: 'correcto' }],
    incidencias: [],
    ...overrides,
  };
}

describe('QrConnectorService', () => {
  let service: QrConnectorService;
  let coreClientService: CoreClientMock;
  let deviceRegistryService: jest.Mocked<
    Pick<DeviceRegistryService, 'registerDevice'>
  >;

  beforeEach(() => {
    coreClientService = buildCoreClientService();
    deviceRegistryService = buildDeviceRegistryService();
    service = new QrConnectorService(
      coreClientService as unknown as CoreClientService,
      deviceRegistryService as unknown as DeviceRegistryService,
    );
  });

  describe('authSession', () => {
    it('devuelve el mismo token del contexto de auth (pass-through) con las organizaciones de CORE', async () => {
      const auth = buildAuthContext();
      const result = await service.authSession(
        { deviceId: 'd-1' },
        auth,
        'correlation-test',
      );

      expect(result.accessToken).toBe(auth.accessToken);
      expect(result.expiresAt).toBe(auth.expiresAt);
      expect(result.organizaciones.some((org) => org.id === 'duoc-uc')).toBe(
        true,
      );
      expect(coreClientService.getEntitlements).toHaveBeenCalledWith(
        'op-1',
        'correlation-test',
      );
    });

    it('registra el deviceId de la request como el dispositivo activo del operador (DOC-002 §1)', async () => {
      const auth = buildAuthContext({
        expiresAt: new Date(Date.now() + 900_000).toISOString(),
      });

      await service.authSession({ deviceId: 'device-nuevo' }, auth, 'corr-1');

      expect(deviceRegistryService.registerDevice).toHaveBeenCalledWith(
        'op-1',
        'device-nuevo',
        expect.any(Number),
      );
      const ttlMs = deviceRegistryService.registerDevice.mock.calls[0][2];
      // TTL calculado desde expiresAt (~900_000ms), con margen por el tiempo real de ejecucion.
      expect(ttlMs).toBeGreaterThan(800_000);
      expect(ttlMs).toBeLessThanOrEqual(900_000);
    });

    it('usa un TTL minimo si el token esta a punto de expirar (evita un PX <= 0 en Redis)', async () => {
      const auth = buildAuthContext({
        expiresAt: new Date(Date.now() + 10).toISOString(),
      });

      await service.authSession({ deviceId: 'device-nuevo' }, auth, 'corr-1');

      const ttlMs = deviceRegistryService.registerDevice.mock.calls[0][2];
      expect(ttlMs).toBeGreaterThanOrEqual(1_000);
    });
  });

  // CIS es un proxy delgado hacia CORE (DOC-006, Fase 3) — la logica de filtrado/idempotencia/
  // clasificacion ya no vive acá, se prueba en core/src (unit + e2e). Estos tests solo verifican
  // que QrConnectorService delega correctamente y propaga resultados/errores tal cual.
  describe('getCatalogo', () => {
    it('delega en CoreClientService y descarta el total (sin paginacion todavia en el contrato de CIS)', async () => {
      const activos = [
        {
          codigoQr: 'QR-0001',
          nombre: 'Notebook Dell Latitude',
          organizacionId: 'duoc-uc',
          areaId: 'laboratorio-informatica',
          ubicacionId: 'melipilla',
          estado: 'activo',
        },
      ];
      coreClientService = buildCoreClientService({
        catalogo: { activos, total: 1 },
      });
      service = new QrConnectorService(
        coreClientService as unknown as CoreClientService,
        deviceRegistryService as unknown as DeviceRegistryService,
      );

      const query: CatalogoQuery = { organizacionId: 'duoc-uc' };
      const result = await service.getCatalogo(query, 'corr-1');

      expect(result).toEqual({ activos });
      expect(coreClientService.getCatalogo).toHaveBeenCalledWith(
        query,
        'corr-1',
      );
    });
  });

  describe('postInventario', () => {
    it('delega en CoreClientService y devuelve su resultado tal cual', async () => {
      const request = buildInventarioRequest();
      const result = await service.postInventario(request, 'corr-1');

      expect(result).toEqual({ inventarioId: 'inv-1', estado: 'recibido' });
      expect(coreClientService.postInventario).toHaveBeenCalledWith(
        request,
        'corr-1',
      );
    });

    it('propaga el 400 de CORE (organización inexistente) sin envolverlo', async () => {
      coreClientService.postInventario.mockRejectedValue(
        new BadRequestException({
          message: 'Rechazado: organización inexistente',
        }),
      );

      await expect(
        service.postInventario(
          buildInventarioRequest({ organizacionId: 'inexistente' }),
          'corr-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('propaga el 409 de CORE (idempotencyKey reutilizada con payload distinto)', async () => {
      coreClientService.postInventario.mockRejectedValue(
        new ConflictException({
          message: 'idempotencyKey ya usada con un payload distinto',
        }),
      );

      await expect(
        service.postInventario(buildInventarioRequest(), 'corr-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getInventarioEstado', () => {
    it('delega en CoreClientService', async () => {
      const result = await service.getInventarioEstado('inv-1', 'corr-1');

      expect(result).toEqual({
        estado: 'recibido',
        ultimoIntento: '2026-08-12T10:00:00.000Z',
      });
      expect(coreClientService.getInventarioEstado).toHaveBeenCalledWith(
        'inv-1',
        'corr-1',
      );
    });

    it('propaga el 404 de CORE para un inventario que no existe', async () => {
      coreClientService.getInventarioEstado.mockRejectedValue(
        new NotFoundException({
          message: "No existe el inventario 'no-existe'",
        }),
      );

      await expect(
        service.getInventarioEstado('no-existe', 'corr-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getInventarios', () => {
    it('delega en CoreClientService con organizacionId', async () => {
      const sesiones: SesionResumenResult[] = [
        {
          id: 'sesion-1',
          organizacionId: 'duoc-uc',
          areaId: 'laboratorio-informatica',
          ubicacionId: 'melipilla',
          operadorId: 'op-1',
          fechaInicio: '2026-08-12T10:00:00.000Z',
          fechaCierre: '2026-08-12T11:00:00.000Z',
          estado: 'recibido',
          creadoEn: '2026-08-12T11:00:05.000Z',
        },
      ];
      coreClientService = buildCoreClientService({ sesiones });
      service = new QrConnectorService(
        coreClientService as unknown as CoreClientService,
        deviceRegistryService as unknown as DeviceRegistryService,
      );

      await expect(service.getInventarios('duoc-uc', 'corr-1')).resolves.toBe(
        sesiones,
      );
      expect(coreClientService.getInventarios).toHaveBeenCalledWith(
        'duoc-uc',
        'corr-1',
      );
    });
  });

  describe('getInventarioDetalle', () => {
    it('delega en CoreClientService con el id', async () => {
      const result = await service.getInventarioDetalle('sesion-1', 'corr-1');

      expect(result.id).toBe('sesion-1');
      expect(coreClientService.getInventarioDetalle).toHaveBeenCalledWith(
        'sesion-1',
        'corr-1',
      );
    });

    it('propaga el 404 de CORE para un id que no existe', async () => {
      coreClientService.getInventarioDetalle.mockRejectedValue(
        new NotFoundException({
          message: "No existe el inventario 'no-existe'",
        }),
      );

      await expect(
        service.getInventarioDetalle('no-existe', 'corr-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
