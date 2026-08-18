import { BadGatewayException } from '@nestjs/common';
import type { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { CipClientService } from './cip-client.service';
import type { CipClientConfig } from './cip-client.config';
import { CircuitBreaker } from '../core-client/circuit-breaker';

function buildAxiosResponse(data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

function buildAxiosNetworkError(): AxiosError {
  return new AxiosError('ECONNREFUSED', AxiosError.ERR_NETWORK);
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

const SYNC_INFO = { actualizadoEn: '2026-08-18T10:00:00.000Z', alDia: true };

describe('CipClientService', () => {
  const config: CipClientConfig = {
    baseUrl: 'http://cip:3002',
    serviceToken: 'secreto-compartido',
  };
  let axiosGet: jest.Mock;
  let httpService: HttpService;
  let breaker: CircuitBreaker;
  let service: CipClientService;

  beforeEach(() => {
    jest.useFakeTimers();
    axiosGet = jest.fn();
    httpService = { axiosRef: { get: axiosGet } } as unknown as HttpService;
    breaker = new CircuitBreaker({ failureThreshold: 100, resetTimeoutMs: 1 });
    service = new CipClientService(config, breaker, httpService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getCobertura', () => {
    it('llama a GET {baseUrl}/dashboard/cobertura con organizacionId y los headers esperados', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({
          activosRegistrados: 3,
          activosEscaneados: 1,
          porcentajeCobertura: 0.333,
          ...SYNC_INFO,
        }),
      );

      const result = await service.getCobertura('duoc-uc', 'correlation-test');

      expect(axiosGet).toHaveBeenCalledWith(
        'http://cip:3002/dashboard/cobertura',
        {
          params: { organizacionId: 'duoc-uc' },
          headers: {
            'x-internal-service-token': 'secreto-compartido',
            'x-correlation-id': 'correlation-test',
          },
        },
      );
      expect(result).toEqual({
        activosRegistrados: 3,
        activosEscaneados: 1,
        porcentajeCobertura: 0.333,
        ...SYNC_INFO,
      });
    });

    it('lanza 502 si CIP devuelve una forma inesperada', async () => {
      axiosGet.mockResolvedValue(buildAxiosResponse({ inesperado: true }));

      await expect(
        service.getCobertura('duoc-uc', 'correlation-test'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('lanza 502 si la request a CIP falla (red/timeout/5xx) tras agotar los reintentos', async () => {
      axiosGet.mockRejectedValue(buildAxiosNetworkError());

      const assertion = expect(
        service.getCobertura('duoc-uc', 'correlation-test'),
      ).rejects.toThrow(BadGatewayException);
      await jest.advanceTimersByTimeAsync(200);
      await jest.advanceTimersByTimeAsync(400);
      await assertion;

      expect(axiosGet).toHaveBeenCalledTimes(3);
    });

    it('reintenta un 5xx de CIP (transitorio) y termina en 502', async () => {
      axiosGet.mockRejectedValue(buildAxiosError(503, { message: 'caido' }));

      const assertion = expect(
        service.getCobertura('duoc-uc', 'correlation-test'),
      ).rejects.toThrow(BadGatewayException);
      await jest.advanceTimersByTimeAsync(200);
      await jest.advanceTimersByTimeAsync(400);
      await assertion;

      expect(axiosGet).toHaveBeenCalledTimes(3);
    });

    it('no reintenta un 4xx de CIP (rechazo permanente) y termina en 502', async () => {
      axiosGet.mockRejectedValue(buildAxiosError(400, { message: 'invalido' }));

      await expect(
        service.getCobertura('duoc-uc', 'correlation-test'),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosGet).toHaveBeenCalledTimes(1);
    });

    it('no reintenta si el error no es un AxiosError (bug inesperado del cliente HTTP)', async () => {
      axiosGet.mockRejectedValue(new Error('bug inesperado, no deberia pasar'));

      await expect(
        service.getCobertura('duoc-uc', 'correlation-test'),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosGet).toHaveBeenCalledTimes(1);
    });

    it('lanza 502 si el circuito está abierto', async () => {
      const openBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 60_000,
      });
      const failingService = new CipClientService(
        config,
        openBreaker,
        httpService,
      );
      axiosGet.mockRejectedValue(buildAxiosNetworkError());

      const primerIntento = expect(
        failingService.getCobertura('duoc-uc', 'correlation-test'),
      ).rejects.toThrow(BadGatewayException);
      await jest.advanceTimersByTimeAsync(200);
      await jest.advanceTimersByTimeAsync(400);
      await primerIntento;

      await expect(
        failingService.getCobertura('duoc-uc', 'correlation-test'),
      ).rejects.toThrow('circuito abierto');
    });
  });

  describe('getAreas', () => {
    it('llama a GET /dashboard/areas y devuelve la lista', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({
          areas: [
            {
              areaId: 'area-1',
              controladaEnPeriodo: true,
              ultimaSesionEn: null,
            },
          ],
          ...SYNC_INFO,
        }),
      );

      const result = await service.getAreas('duoc-uc', 'correlation-test');

      expect(axiosGet).toHaveBeenCalledWith(
        'http://cip:3002/dashboard/areas',
        expect.objectContaining({ params: { organizacionId: 'duoc-uc' } }),
      );
      expect(result.areas).toHaveLength(1);
    });
  });

  describe('getSesiones', () => {
    it('incluye areaId y paginación cuando se pasan', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ items: [], total: 0, ...SYNC_INFO }),
      );

      await service.getSesiones(
        'duoc-uc',
        'area-1',
        { limit: 20, offset: 0 },
        'correlation-test',
      );

      expect(axiosGet).toHaveBeenCalledWith(
        'http://cip:3002/dashboard/sesiones',
        expect.objectContaining({
          params: {
            organizacionId: 'duoc-uc',
            areaId: 'area-1',
            limit: 20,
            offset: 0,
          },
        }),
      );
    });

    it('omite areaId cuando no se pasa', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ items: [], total: 0, ...SYNC_INFO }),
      );

      await service.getSesiones(
        'duoc-uc',
        undefined,
        { limit: 20, offset: 0 },
        'correlation-test',
      );

      expect(axiosGet).toHaveBeenCalledWith(
        'http://cip:3002/dashboard/sesiones',
        expect.objectContaining({
          params: {
            organizacionId: 'duoc-uc',
            areaId: undefined,
            limit: 20,
            offset: 0,
          },
        }),
      );
    });
  });

  describe('getFueraDeArea', () => {
    it('llama a GET /dashboard/fuera-de-area', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ items: [], total: 0, ...SYNC_INFO }),
      );

      await service.getFueraDeArea(
        'duoc-uc',
        undefined,
        { limit: 20, offset: 0 },
        'correlation-test',
      );

      expect(axiosGet).toHaveBeenCalledWith(
        'http://cip:3002/dashboard/fuera-de-area',
        expect.any(Object),
      );
    });
  });

  describe('getNoLocalizados', () => {
    it('llama a GET /dashboard/no-localizados', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ items: [], total: 0, ...SYNC_INFO }),
      );

      await service.getNoLocalizados(
        'duoc-uc',
        { limit: 20, offset: 0 },
        'correlation-test',
      );

      expect(axiosGet).toHaveBeenCalledWith(
        'http://cip:3002/dashboard/no-localizados',
        expect.objectContaining({
          params: { organizacionId: 'duoc-uc', limit: 20, offset: 0 },
        }),
      );
    });
  });

  describe('getIncidencias', () => {
    it('incluye codigoQr cuando se pasa', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ items: [], total: 0, ...SYNC_INFO }),
      );

      await service.getIncidencias(
        'duoc-uc',
        'QR-1',
        { limit: 20, offset: 0 },
        'correlation-test',
      );

      expect(axiosGet).toHaveBeenCalledWith(
        'http://cip:3002/dashboard/incidencias',
        expect.objectContaining({
          params: {
            organizacionId: 'duoc-uc',
            codigoQr: 'QR-1',
            limit: 20,
            offset: 0,
          },
        }),
      );
    });
  });

  describe('getEstadoActivos', () => {
    it('llama a GET /dashboard/estado-activos', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ estados: [], ...SYNC_INFO }),
      );

      const result = await service.getEstadoActivos(
        'duoc-uc',
        'correlation-test',
      );

      expect(axiosGet).toHaveBeenCalledWith(
        'http://cip:3002/dashboard/estado-activos',
        expect.objectContaining({ params: { organizacionId: 'duoc-uc' } }),
      );
      expect(result.estados).toEqual([]);
    });
  });

  describe('getCategorias', () => {
    it('incluye areaId cuando se pasa', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ categorias: [], ...SYNC_INFO }),
      );

      await service.getCategorias('duoc-uc', 'area-1', 'correlation-test');

      expect(axiosGet).toHaveBeenCalledWith(
        'http://cip:3002/dashboard/categorias',
        expect.objectContaining({
          params: { organizacionId: 'duoc-uc', areaId: 'area-1' },
        }),
      );
    });
  });
});
