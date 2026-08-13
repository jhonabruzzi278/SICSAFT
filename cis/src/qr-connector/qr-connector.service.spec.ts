import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QrConnectorService } from './qr-connector.service';
import { CatalogoQuery, InventarioRequest } from './qr-connector.schemas';
import type { ZitadelAuthContext } from '../common/auth/zitadel-auth.guard';
import type { CoreClientService } from '../core-client/core-client.service';
import type {
  CatalogoResult,
  EntitlementsResult,
  InventarioEstadoResult,
  PostInventarioResult,
} from '../core-client/core-client.types';

type CoreClientMock = jest.Mocked<
  Pick<
    CoreClientService,
    'getEntitlements' | 'getCatalogo' | 'postInventario' | 'getInventarioEstado'
  >
>;

function buildCoreClientService(
  overrides: {
    entitlements?: EntitlementsResult;
    catalogo?: CatalogoResult;
    postInventarioResult?: PostInventarioResult;
    inventarioEstado?: InventarioEstadoResult;
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
  };
}

function buildAuthContext(
  overrides: Partial<ZitadelAuthContext> = {},
): ZitadelAuthContext {
  return {
    operadorId: 'op-1',
    accessToken: 'zitadel-token',
    expiresAt: '2026-08-12T10:15:00.000Z',
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

  beforeEach(() => {
    coreClientService = buildCoreClientService();
    service = new QrConnectorService(
      coreClientService as unknown as CoreClientService,
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
});
