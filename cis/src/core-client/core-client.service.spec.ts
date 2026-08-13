import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { CoreClientService } from './core-client.service';
import type { CoreClientConfig } from './core-client.config';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';

function buildAxiosResponse(data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

function buildAxiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError('Request failed', String(status));
  error.response = {
    data,
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

describe('CoreClientService', () => {
  const config: CoreClientConfig = {
    baseUrl: 'http://core:3001',
    serviceToken: 'secreto-compartido',
  };
  let axiosGet: jest.Mock;
  let axiosPost: jest.Mock;
  let httpService: HttpService;
  let breaker: CircuitBreaker;
  let service: CoreClientService;

  beforeEach(() => {
    axiosGet = jest.fn();
    axiosPost = jest.fn();
    httpService = {
      axiosRef: { get: axiosGet, post: axiosPost },
    } as unknown as HttpService;
    // Umbral alto: en estos tests un solo fallo nunca debe abrir el circuito por accidente.
    breaker = new CircuitBreaker({ failureThreshold: 100, resetTimeoutMs: 1 });
    service = new CoreClientService(config, breaker, httpService);
  });

  describe('getEntitlements', () => {
    it('llama a GET {baseUrl}/entitlements con operadorId y los headers esperados', async () => {
      axiosGet.mockResolvedValue(buildAxiosResponse({ organizaciones: [] }));

      await service.getEntitlements('op-1', 'correlation-test');

      expect(axiosGet).toHaveBeenCalledWith('http://core:3001/entitlements', {
        params: { operadorId: 'op-1' },
        headers: {
          'x-internal-service-token': 'secreto-compartido',
          'x-correlation-id': 'correlation-test',
        },
      });
    });

    it('devuelve las organizaciones cuando CORE responde una forma valida', async () => {
      const organizaciones = [
        {
          id: 'duoc-uc',
          nombre: 'DUOC UC',
          sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
        },
      ];
      axiosGet.mockResolvedValue(buildAxiosResponse({ organizaciones }));

      const result = await service.getEntitlements('op-1', 'correlation-test');

      expect(result).toEqual({ organizaciones });
    });

    it('lanza 502 si la request a CORE falla (red/timeout/5xx)', async () => {
      axiosGet.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.getEntitlements('op-1', 'correlation-test'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('lanza 502 si CORE responde una forma inesperada', async () => {
      axiosGet.mockResolvedValue(buildAxiosResponse({ algoDistinto: true }));

      await expect(
        service.getEntitlements('op-1', 'correlation-test'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getCatalogo', () => {
    it('llama a GET {baseUrl}/catalogo con la query completa', async () => {
      axiosGet.mockResolvedValue(buildAxiosResponse({ activos: [], total: 0 }));

      await service.getCatalogo(
        { organizacionId: 'duoc-uc', areaId: 'area-1' },
        'corr-1',
      );

      expect(axiosGet).toHaveBeenCalledWith('http://core:3001/catalogo', {
        params: { organizacionId: 'duoc-uc', areaId: 'area-1' },
        headers: {
          'x-internal-service-token': 'secreto-compartido',
          'x-correlation-id': 'corr-1',
        },
      });
    });

    it('devuelve activos cuando CORE responde una forma valida', async () => {
      const activos = [
        {
          codigoQr: 'QR-000001',
          nombre: 'Dell Latitude 5440',
          organizacionId: 'duoc-uc',
          areaId: 'area-biblioteca',
          ubicacionId: 'ubicacion-biblioteca-101',
          estado: 'activo',
        },
      ];
      axiosGet.mockResolvedValue(buildAxiosResponse({ activos, total: 1 }));

      await expect(
        service.getCatalogo({ organizacionId: 'duoc-uc' }, 'corr-1'),
      ).resolves.toEqual({ activos, total: 1 });
    });
  });

  describe('postInventario', () => {
    const request = {
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
    };

    it('llama a POST {baseUrl}/inventarios con el body completo', async () => {
      axiosPost.mockResolvedValue(
        buildAxiosResponse({ inventarioId: 'sesion-1', estado: 'recibido' }),
      );

      await service.postInventario(request, 'x-corr-http');

      expect(axiosPost).toHaveBeenCalledWith(
        'http://core:3001/inventarios',
        request,
        {
          headers: {
            'x-internal-service-token': 'secreto-compartido',
            'x-correlation-id': 'x-corr-http',
          },
        },
      );
    });

    it('devuelve el resultado cuando CORE responde 201', async () => {
      axiosPost.mockResolvedValue(
        buildAxiosResponse({ inventarioId: 'sesion-1', estado: 'recibido' }),
      );

      await expect(
        service.postInventario(request, 'x-corr-http'),
      ).resolves.toEqual({ inventarioId: 'sesion-1', estado: 'recibido' });
    });

    it('propaga un 400 de CORE como BadRequestException con el mismo body', async () => {
      const cuerpo = {
        message: 'Rechazado',
        errores: [{ campo: 'x', detalle: 'y' }],
      };
      axiosPost.mockRejectedValue(buildAxiosError(400, cuerpo));

      await expect(
        service.postInventario(request, 'x-corr-http'),
      ).rejects.toThrow(BadRequestException);

      axiosPost.mockRejectedValue(buildAxiosError(400, cuerpo));
      try {
        await service.postInventario(request, 'x-corr-http');
        throw new Error('deberia haber lanzado');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual(cuerpo);
      }
    });

    it('propaga un 409 de CORE como ConflictException con el mismo body', async () => {
      const cuerpo = { message: 'idempotencyKey ya usada' };
      axiosPost.mockRejectedValue(buildAxiosError(409, cuerpo));

      await expect(
        service.postInventario(request, 'x-corr-http'),
      ).rejects.toThrow(ConflictException);
    });

    it('un 5xx de CORE se propaga como 502, no como el status original', async () => {
      axiosPost.mockRejectedValue(buildAxiosError(500, { message: 'boom' }));

      await expect(
        service.postInventario(request, 'x-corr-http'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('getInventarioEstado', () => {
    it('llama a GET {baseUrl}/inventarios/:id/estado', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({
          estado: 'recibido',
          ultimoIntento: '2026-01-15T10:30:00.000Z',
        }),
      );

      await service.getInventarioEstado('sesion-1', 'corr-1');

      expect(axiosGet).toHaveBeenCalledWith(
        'http://core:3001/inventarios/sesion-1/estado',
        {
          params: undefined,
          headers: {
            'x-internal-service-token': 'secreto-compartido',
            'x-correlation-id': 'corr-1',
          },
        },
      );
    });

    it('propaga un 404 de CORE como NotFoundException', async () => {
      axiosGet.mockRejectedValue(
        buildAxiosError(404, { message: "No existe el inventario 'x'" }),
      );

      await expect(service.getInventarioEstado('x', 'corr-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('escapa el inventarioId al armar la URL', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({
          estado: 'recibido',
          ultimoIntento: '2026-01-15T10:30:00.000Z',
        }),
      );

      await service.getInventarioEstado('id con espacio', 'corr-1');

      expect(axiosGet).toHaveBeenCalledWith(
        'http://core:3001/inventarios/id%20con%20espacio/estado',
        expect.anything(),
      );
    });
  });

  describe('circuit breaker', () => {
    it('cuando el circuito esta abierto, lanza 502 sin llamar a axios', async () => {
      const breakerAbierto = {
        execute: jest.fn().mockRejectedValue(new CircuitOpenError()),
      } as unknown as CircuitBreaker;
      const serviceConCircuitoAbierto = new CoreClientService(
        config,
        breakerAbierto,
        httpService,
      );

      await expect(
        serviceConCircuitoAbierto.getEntitlements('op-1', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosGet).not.toHaveBeenCalled();
    });
  });
});
