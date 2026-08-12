import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QrConnectorService } from './qr-connector.service';
import { InventarioRequest } from './qr-connector.schemas';
import type { ZitadelAuthContext } from '../common/auth/zitadel-auth.guard';

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

  beforeEach(() => {
    service = new QrConnectorService();
  });

  describe('authSession', () => {
    it('devuelve el mismo token del contexto de auth (pass-through) con las organizaciones seed', () => {
      const auth = buildAuthContext();
      const result = service.authSession({ deviceId: 'd-1' }, auth);

      expect(result.accessToken).toBe(auth.accessToken);
      expect(result.expiresAt).toBe(auth.expiresAt);
      expect(result.organizaciones.some((org) => org.id === 'duoc-uc')).toBe(
        true,
      );
    });
  });

  describe('getCatalogo', () => {
    it('filters by organizacionId', () => {
      const result = service.getCatalogo({ organizacionId: 'duoc-uc' });
      expect(result.activos.length).toBeGreaterThan(0);
      expect(
        result.activos.every((activo) => activo.organizacionId === 'duoc-uc'),
      ).toBe(true);
    });

    it('filters by areaId cuando se especifica', () => {
      const result = service.getCatalogo({
        organizacionId: 'duoc-uc',
        areaId: 'sala-clases',
      });
      expect(result.activos).toHaveLength(1);
      expect(result.activos[0].areaId).toBe('sala-clases');
    });

    it('filtra por ubicacionId cuando se especifica', () => {
      const result = service.getCatalogo({
        organizacionId: 'duoc-uc',
        ubicacionId: 'melipilla',
      });
      expect(result.activos.length).toBeGreaterThan(0);
      expect(
        result.activos.every((activo) => activo.ubicacionId === 'melipilla'),
      ).toBe(true);
    });

    it('devuelve vacio para una organizacion inexistente', () => {
      const result = service.getCatalogo({ organizacionId: 'inexistente' });
      expect(result.activos).toHaveLength(0);
    });
  });

  describe('postInventario', () => {
    it('acepta un inventario nuevo y lo marca recibido', () => {
      const result = service.postInventario(buildInventarioRequest());
      expect(result.estado).toBe('recibido');
      expect(result.inventarioId).toBeTruthy();
    });

    it('rechaza organizacion inexistente sin reintentar', () => {
      expect(() =>
        service.postInventario(
          buildInventarioRequest({ organizacionId: 'inexistente' }),
        ),
      ).toThrow(BadRequestException);
    });

    it('es idempotente: misma key + mismo payload devuelve el mismo resultado', () => {
      const request = buildInventarioRequest();
      const first = service.postInventario(request);
      const second = service.postInventario(request);
      expect(second).toEqual(first);
    });

    it('rechaza con 409 si la key se reutiliza con un payload distinto', () => {
      const request = buildInventarioRequest();
      service.postInventario(request);

      expect(() =>
        service.postInventario({ ...request, operadorId: 'otro-operador' }),
      ).toThrow(ConflictException);
    });
  });

  describe('getInventarioEstado', () => {
    it('devuelve el estado de un inventario ya recibido', () => {
      const posted = service.postInventario(buildInventarioRequest());
      const estado = service.getInventarioEstado(posted.inventarioId);
      expect(estado.estado).toBe('recibido');
      expect(Number.isNaN(Date.parse(estado.ultimoIntento))).toBe(false);
    });

    it('lanza 404 para un inventario que no existe', () => {
      expect(() => service.getInventarioEstado('no-existe')).toThrow(
        NotFoundException,
      );
    });
  });
});
