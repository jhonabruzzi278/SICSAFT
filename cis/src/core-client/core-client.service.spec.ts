import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
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

// Sin `.response` — asi lanza axios real ante ECONNREFUSED/timeout (no llega a haber respuesta
// HTTP), a diferencia de un 4xx/5xx que si trae una.
function buildAxiosNetworkError(): AxiosError {
  return new AxiosError('ECONNREFUSED', AxiosError.ERR_NETWORK);
}

describe('CoreClientService', () => {
  const config: CoreClientConfig = {
    baseUrl: 'http://core:3001',
    serviceToken: 'secreto-compartido',
  };
  let axiosGet: jest.Mock;
  let axiosPost: jest.Mock;
  let axiosPatch: jest.Mock;
  let httpService: HttpService;
  let breaker: CircuitBreaker;
  let service: CoreClientService;

  beforeEach(() => {
    jest.useFakeTimers();
    axiosGet = jest.fn();
    axiosPost = jest.fn();
    axiosPatch = jest.fn();
    httpService = {
      axiosRef: { get: axiosGet, post: axiosPost, patch: axiosPatch },
    } as unknown as HttpService;
    // Umbral alto: en estos tests un solo fallo nunca debe abrir el circuito por accidente.
    breaker = new CircuitBreaker({ failureThreshold: 100, resetTimeoutMs: 1 });
    service = new CoreClientService(config, breaker, httpService);
  });

  afterEach(() => {
    jest.useRealTimers();
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

    it('lanza 502 si la request a CORE falla (red/timeout/5xx) tras agotar los reintentos', async () => {
      axiosGet.mockRejectedValue(buildAxiosNetworkError());

      const assertion = expect(
        service.getEntitlements('op-1', 'correlation-test'),
      ).rejects.toThrow(BadGatewayException);
      await jest.advanceTimersByTimeAsync(200); // backoff del 1er reintento
      await jest.advanceTimersByTimeAsync(400); // backoff del 2do reintento (exponencial)
      await assertion;

      // WAF 4: reintentos con backoff, nunca reintento inmediato en bucle — 3 intentos totales.
      expect(axiosGet).toHaveBeenCalledTimes(3);
    });

    it('no reintenta si el error no es un AxiosError (bug inesperado del cliente HTTP)', async () => {
      axiosGet.mockRejectedValue(new Error('bug inesperado, no deberia pasar'));

      await expect(
        service.getEntitlements('op-1', 'correlation-test'),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosGet).toHaveBeenCalledTimes(1);
    });

    it('reintenta un fallo transitorio y tiene éxito en un intento posterior, sin propagar error', async () => {
      axiosGet
        .mockRejectedValueOnce(buildAxiosNetworkError())
        .mockResolvedValueOnce(buildAxiosResponse({ organizaciones: [] }));

      const resultPromise = service.getEntitlements('op-1', 'correlation-test');
      await jest.advanceTimersByTimeAsync(200); // backoff del unico reintento necesario

      await expect(resultPromise).resolves.toEqual({ organizaciones: [] });
      expect(axiosGet).toHaveBeenCalledTimes(2);
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
          id: 'activo-1',
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

    it('propaga un 400 de CORE como BadRequestException con el mismo body, sin reintentar', async () => {
      const cuerpo = {
        message: 'Rechazado',
        errores: [{ campo: 'x', detalle: 'y' }],
      };
      axiosPost.mockRejectedValue(buildAxiosError(400, cuerpo));

      try {
        await service.postInventario(request, 'x-corr-http');
        throw new Error('deberia haber lanzado');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual(cuerpo);
      }
      // Rechazo permanente (DOC-002 5) — un solo intento, nunca se reintenta un 400.
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('propaga un 409 de CORE como ConflictException con el mismo body, sin reintentar', async () => {
      const cuerpo = { message: 'idempotencyKey ya usada' };
      axiosPost.mockRejectedValue(buildAxiosError(409, cuerpo));

      await expect(
        service.postInventario(request, 'x-corr-http'),
      ).rejects.toThrow(ConflictException);
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('un 5xx de CORE se propaga como 502, no como el status original, tras reintentar', async () => {
      axiosPost.mockRejectedValue(buildAxiosError(500, { message: 'boom' }));

      const assertion = expect(
        service.postInventario(request, 'x-corr-http'),
      ).rejects.toThrow(BadGatewayException);
      await jest.advanceTimersByTimeAsync(200);
      await jest.advanceTimersByTimeAsync(400);
      await assertion;

      expect(axiosPost).toHaveBeenCalledTimes(3);
    });
  });

  describe('postActivo', () => {
    const request = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      codigoPatrimonial: 'AFT-1',
      codigoQr: 'QR-1',
      catalogoId: 'catalogo-notebook',
    };
    const activo = {
      id: 'activo-1',
      codigoPatrimonial: 'AFT-1',
      codigoQr: 'QR-1',
      organizacionId: 'duoc-uc',
      areaId: null,
      ubicacionId: null,
      responsableId: null,
      estado: 'activo',
      descripcion: null,
      catalogo: {
        tipo: 'Equipo Computacional',
        familia: 'Informática',
        subfamilia: null,
        marca: null,
        modelo: null,
      },
    };

    it('llama a POST {baseUrl}/activos con el body completo', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse(activo));

      await service.postActivo(request, 'x-corr-http');

      expect(axiosPost).toHaveBeenCalledWith(
        'http://core:3001/activos',
        request,
        {
          headers: {
            'x-internal-service-token': 'secreto-compartido',
            'x-correlation-id': 'x-corr-http',
          },
        },
      );
    });

    it('devuelve el activo cuando CORE responde 201', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse(activo));

      await expect(service.postActivo(request, 'x-corr-http')).resolves.toEqual(
        activo,
      );
    });

    it('propaga un 403 de CORE como ForbiddenException, sin reintentar', async () => {
      const cuerpo = { message: 'Requiere el rol administrador-patrimonial' };
      axiosPost.mockRejectedValue(buildAxiosError(403, cuerpo));

      try {
        await service.postActivo(request, 'x-corr-http');
        throw new Error('deberia haber lanzado');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect((error as ForbiddenException).getResponse()).toEqual(cuerpo);
      }
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('propaga un 400 de CORE como BadRequestException, sin reintentar', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(400, { message: 'catalogoId inexistente' }),
      );

      await expect(service.postActivo(request, 'x-corr-http')).rejects.toThrow(
        BadRequestException,
      );
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('propaga un 409 de CORE como ConflictException, sin reintentar', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(409, { message: 'ya existe' }),
      );

      await expect(service.postActivo(request, 'x-corr-http')).rejects.toThrow(
        ConflictException,
      );
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('getContratos', () => {
    const contrato = {
      id: 'contrato-1',
      organizacionId: 'duoc-uc',
      organizacionNombre: 'DUOC UC',
      sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
      vigenciaDesde: '2026-01-01T00:00:00.000Z',
      vigenciaHasta: null,
      estado: 'vigente',
      modulosContratados: ['inventario-qr'],
    };

    const pagina = { contratos: [contrato], total: 1 };

    it('llama a GET {baseUrl}/contratos con limit/offset', async () => {
      axiosGet.mockResolvedValue(buildAxiosResponse(pagina));

      await service.getContratos({ limit: 20, offset: 0 }, 'corr-1');

      expect(axiosGet).toHaveBeenCalledWith('http://core:3001/contratos', {
        params: { limit: 20, offset: 0 },
        headers: {
          'x-internal-service-token': 'secreto-compartido',
          'x-correlation-id': 'corr-1',
        },
      });
    });

    it('devuelve los contratos paginados cuando CORE responde una forma valida', async () => {
      axiosGet.mockResolvedValue(buildAxiosResponse(pagina));

      await expect(
        service.getContratos({ limit: 20, offset: 0 }, 'corr-1'),
      ).resolves.toEqual(pagina);
    });
  });

  describe('postContrato', () => {
    const request = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      sedeIds: ['melipilla'],
      vigenciaDesde: '2026-01-01T00:00:00.000Z',
      modulosContratados: ['inventario-qr'],
    };
    const contrato = {
      id: 'contrato-1',
      organizacionId: 'duoc-uc',
      organizacionNombre: 'DUOC UC',
      sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
      vigenciaDesde: '2026-01-01T00:00:00.000Z',
      vigenciaHasta: null,
      estado: 'vigente',
      modulosContratados: ['inventario-qr'],
    };

    it('llama a POST {baseUrl}/contratos con el body completo', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse(contrato));

      await service.postContrato(request, 'x-corr-http');

      expect(axiosPost).toHaveBeenCalledWith(
        'http://core:3001/contratos',
        request,
        {
          headers: {
            'x-internal-service-token': 'secreto-compartido',
            'x-correlation-id': 'x-corr-http',
          },
        },
      );
    });

    it('propaga un 403 de CORE como ForbiddenException, sin reintentar', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(403, { message: 'sin permiso' }),
      );

      await expect(
        service.postContrato(request, 'x-corr-http'),
      ).rejects.toThrow(ForbiddenException);
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('propaga un 409 de CORE como ConflictException, sin reintentar', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(409, { message: 'sede ya cubierta' }),
      );

      await expect(
        service.postContrato(request, 'x-corr-http'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('patchContrato', () => {
    const request = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      estado: 'suspendido',
    };
    const contrato = {
      id: 'contrato-1',
      organizacionId: 'duoc-uc',
      organizacionNombre: 'DUOC UC',
      sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
      vigenciaDesde: '2026-01-01T00:00:00.000Z',
      vigenciaHasta: null,
      estado: 'suspendido',
      modulosContratados: ['inventario-qr'],
    };

    it('llama a PATCH {baseUrl}/contratos/:id con el body completo', async () => {
      axiosPatch.mockResolvedValue(buildAxiosResponse(contrato));

      await service.patchContrato('contrato-1', request, 'x-corr-http');

      expect(axiosPatch).toHaveBeenCalledWith(
        'http://core:3001/contratos/contrato-1',
        request,
        {
          headers: {
            'x-internal-service-token': 'secreto-compartido',
            'x-correlation-id': 'x-corr-http',
          },
        },
      );
    });

    it('devuelve el contrato actualizado cuando CORE responde una forma valida', async () => {
      axiosPatch.mockResolvedValue(buildAxiosResponse(contrato));

      await expect(
        service.patchContrato('contrato-1', request, 'x-corr-http'),
      ).resolves.toEqual(contrato);
    });

    it('escapa el contratoId al armar la URL', async () => {
      axiosPatch.mockResolvedValue(buildAxiosResponse(contrato));

      await service.patchContrato('id con espacio', request, 'x-corr-http');

      expect(axiosPatch).toHaveBeenCalledWith(
        'http://core:3001/contratos/id%20con%20espacio',
        request,
        expect.anything(),
      );
    });

    it('propaga un 400 de CORE como BadRequestException, sin reintentar', async () => {
      axiosPatch.mockRejectedValue(
        buildAxiosError(400, { message: 'transicion invalida' }),
      );

      await expect(
        service.patchContrato('contrato-1', request, 'x-corr-http'),
      ).rejects.toThrow(BadRequestException);
      expect(axiosPatch).toHaveBeenCalledTimes(1);
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

    it('propaga un 404 de CORE como NotFoundException, sin reintentar', async () => {
      axiosGet.mockRejectedValue(
        buildAxiosError(404, { message: "No existe el inventario 'x'" }),
      );

      await expect(service.getInventarioEstado('x', 'corr-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(axiosGet).toHaveBeenCalledTimes(1);
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

  describe('getInventarios', () => {
    const sesion = {
      id: 'sesion-1',
      organizacionId: 'duoc-uc',
      areaId: 'laboratorio-informatica',
      ubicacionId: 'melipilla',
      operadorId: 'op-1',
      fechaInicio: '2026-01-15T10:00:00.000Z',
      fechaCierre: '2026-01-15T10:30:00.000Z',
      estado: 'recibido',
      creadoEn: '2026-01-15T10:30:05.000Z',
    };

    it('llama a GET {baseUrl}/inventarios con organizacionId', async () => {
      axiosGet.mockResolvedValue(buildAxiosResponse([sesion]));

      await service.getInventarios('duoc-uc', 'corr-1');

      expect(axiosGet).toHaveBeenCalledWith('http://core:3001/inventarios', {
        params: { organizacionId: 'duoc-uc' },
        headers: {
          'x-internal-service-token': 'secreto-compartido',
          'x-correlation-id': 'corr-1',
        },
      });
    });

    it('devuelve las sesiones cuando CORE responde una forma valida', async () => {
      axiosGet.mockResolvedValue(buildAxiosResponse([sesion]));

      await expect(
        service.getInventarios('duoc-uc', 'corr-1'),
      ).resolves.toEqual([sesion]);
    });
  });

  describe('getInventarioDetalle', () => {
    const detalle = {
      id: 'sesion-1',
      organizacionId: 'duoc-uc',
      areaId: 'laboratorio-informatica',
      ubicacionId: 'melipilla',
      operadorId: 'op-1',
      fechaInicio: '2026-01-15T10:00:00.000Z',
      fechaCierre: '2026-01-15T10:30:00.000Z',
      estado: 'recibido',
      creadoEn: '2026-01-15T10:30:05.000Z',
      escaneos: [
        { codigoQr: 'QR-0001', resultado: 'correcto', observaciones: null },
      ],
    };

    it('llama a GET {baseUrl}/inventarios/:id', async () => {
      axiosGet.mockResolvedValue(buildAxiosResponse(detalle));

      await service.getInventarioDetalle('sesion-1', 'corr-1');

      expect(axiosGet).toHaveBeenCalledWith(
        'http://core:3001/inventarios/sesion-1',
        {
          params: undefined,
          headers: {
            'x-internal-service-token': 'secreto-compartido',
            'x-correlation-id': 'corr-1',
          },
        },
      );
    });

    it('devuelve el detalle cuando CORE responde una forma valida', async () => {
      axiosGet.mockResolvedValue(buildAxiosResponse(detalle));

      await expect(
        service.getInventarioDetalle('sesion-1', 'corr-1'),
      ).resolves.toEqual(detalle);
    });

    it('propaga un 404 de CORE como NotFoundException', async () => {
      axiosGet.mockRejectedValue(
        buildAxiosError(404, { message: "No existe el inventario 'x'" }),
      );

      await expect(service.getInventarioDetalle('x', 'corr-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAuditoria', () => {
    const entrada = {
      id: 'audit-1',
      usuario: 'op-1',
      fecha: '2026-08-14T10:00:00.000Z',
      equipo: null,
      ip: null,
      operacion: 'POST /inventarios',
      resultado: 'recibido',
      observaciones: null,
    };

    it('llama a GET {baseUrl}/auditoria sin filtros', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ entradas: [entrada], total: 1 }),
      );

      await service.getAuditoria({}, 'corr-1');

      expect(axiosGet).toHaveBeenCalledWith('http://core:3001/auditoria', {
        params: {
          usuario: undefined,
          operacion: undefined,
          fechaDesde: undefined,
          fechaHasta: undefined,
          limit: undefined,
          offset: undefined,
        },
        headers: {
          'x-internal-service-token': 'secreto-compartido',
          'x-correlation-id': 'corr-1',
        },
      });
    });

    it('llama a GET {baseUrl}/auditoria con los filtros y la paginacion como query params', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ entradas: [entrada], total: 1 }),
      );

      await service.getAuditoria(
        {
          usuario: 'op-1',
          operacion: 'baja',
          fechaDesde: '2026-08-01T00:00:00.000Z',
          fechaHasta: '2026-08-14T23:59:59.000Z',
          limit: 20,
          offset: 0,
        },
        'corr-1',
      );

      expect(axiosGet).toHaveBeenCalledWith('http://core:3001/auditoria', {
        params: {
          usuario: 'op-1',
          operacion: 'baja',
          fechaDesde: '2026-08-01T00:00:00.000Z',
          fechaHasta: '2026-08-14T23:59:59.000Z',
          limit: 20,
          offset: 0,
        },
        headers: {
          'x-internal-service-token': 'secreto-compartido',
          'x-correlation-id': 'corr-1',
        },
      });
    });

    it('devuelve las entradas paginadas cuando CORE responde una forma valida', async () => {
      const pagina = { entradas: [entrada], total: 1 };
      axiosGet.mockResolvedValue(buildAxiosResponse(pagina));

      await expect(service.getAuditoria({}, 'corr-1')).resolves.toEqual(pagina);
    });
  });

  describe('Area (RF-05)', () => {
    const area = {
      id: 'area-1',
      organizacionId: 'duoc-uc',
      codigo: 'BIB',
      nombre: 'Biblioteca',
      dependencia: null,
      centroCosto: null,
      responsableId: null,
      ubicacionPrincipalId: null,
    };
    const postAreaRequest = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      codigo: 'BIB',
      nombre: 'Biblioteca',
    };

    it('getAreas llama a GET {baseUrl}/areas con organizacionId y paginacion', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ areas: [area], total: 1 }),
      );

      await service.getAreas('duoc-uc', { limit: 20, offset: 0 }, 'corr-1');

      expect(axiosGet).toHaveBeenCalledWith('http://core:3001/areas', {
        params: { organizacionId: 'duoc-uc', limit: 20, offset: 0 },
        headers: {
          'x-internal-service-token': 'secreto-compartido',
          'x-correlation-id': 'corr-1',
        },
      });
    });

    it('postArea llama a POST {baseUrl}/areas y devuelve el area creada', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse(area));

      await expect(
        service.postArea(postAreaRequest, 'corr-1'),
      ).resolves.toEqual(area);
      expect(axiosPost).toHaveBeenCalledWith(
        'http://core:3001/areas',
        postAreaRequest,
        expect.anything(),
      );
    });

    it('postArea propaga un 403 de CORE como ForbiddenException', async () => {
      axiosPost.mockRejectedValue(buildAxiosError(403, { message: 'sin rol' }));

      await expect(service.postArea(postAreaRequest, 'corr-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('patchArea llama a PATCH {baseUrl}/areas/:id y devuelve el area actualizada', async () => {
      const actualizada = { ...area, nombre: 'Biblioteca Central' };
      axiosPatch.mockResolvedValue(buildAxiosResponse(actualizada));
      const patchRequest = {
        correlationId: 'corr-1',
        operadorId: 'op-admin',
        organizacionId: 'duoc-uc',
        rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        nombre: 'Biblioteca Central',
      };

      await expect(
        service.patchArea('area-1', patchRequest, 'corr-1'),
      ).resolves.toEqual(actualizada);
      expect(axiosPatch).toHaveBeenCalledWith(
        'http://core:3001/areas/area-1',
        patchRequest,
        expect.anything(),
      );
    });

    it('patchArea propaga un 404 de CORE como NotFoundException', async () => {
      axiosPatch.mockRejectedValue(
        buildAxiosError(404, { message: "No existe el area 'x'" }),
      );

      await expect(
        service.patchArea(
          'no-existe',
          {
            correlationId: 'corr-1',
            operadorId: 'op-admin',
            organizacionId: 'duoc-uc',
            rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
            nombre: 'X',
          },
          'corr-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Ubicacion (RF-05)', () => {
    const ubicacion = {
      id: 'ubicacion-1',
      sedeId: 'melipilla',
      edificio: null,
      piso: null,
      areaId: null,
      oficina: null,
      dependencia: null,
    };
    const postUbicacionRequest = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      sedeId: 'melipilla',
    };

    it('getUbicaciones llama a GET {baseUrl}/ubicaciones con sedeId y paginacion', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ ubicaciones: [ubicacion], total: 1 }),
      );

      await service.getUbicaciones(
        'melipilla',
        { limit: 20, offset: 0 },
        'corr-1',
      );

      expect(axiosGet).toHaveBeenCalledWith('http://core:3001/ubicaciones', {
        params: { sedeId: 'melipilla', limit: 20, offset: 0 },
        headers: {
          'x-internal-service-token': 'secreto-compartido',
          'x-correlation-id': 'corr-1',
        },
      });
    });

    it('postUbicacion llama a POST {baseUrl}/ubicaciones y devuelve la ubicacion creada', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse(ubicacion));

      await expect(
        service.postUbicacion(postUbicacionRequest, 'corr-1'),
      ).resolves.toEqual(ubicacion);
    });

    it('postUbicacion propaga un 400 de CORE como BadRequestException', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(400, { message: "sedeId 'x' inexistente" }),
      );

      await expect(
        service.postUbicacion(postUbicacionRequest, 'corr-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('patchUbicacion llama a PATCH {baseUrl}/ubicaciones/:id y devuelve la ubicacion actualizada', async () => {
      const actualizada = { ...ubicacion, edificio: 'Torre A' };
      axiosPatch.mockResolvedValue(buildAxiosResponse(actualizada));
      const patchRequest = {
        correlationId: 'corr-1',
        operadorId: 'op-admin',
        organizacionId: 'duoc-uc',
        rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        edificio: 'Torre A',
      };

      await expect(
        service.patchUbicacion('ubicacion-1', patchRequest, 'corr-1'),
      ).resolves.toEqual(actualizada);
      expect(axiosPatch).toHaveBeenCalledWith(
        'http://core:3001/ubicaciones/ubicacion-1',
        patchRequest,
        expect.anything(),
      );
    });

    it('patchUbicacion propaga un 400 de CORE como BadRequestException', async () => {
      axiosPatch.mockRejectedValue(
        buildAxiosError(400, { message: "areaId 'x' inexistente" }),
      );

      await expect(
        service.patchUbicacion(
          'ubicacion-1',
          {
            correlationId: 'corr-1',
            operadorId: 'op-admin',
            organizacionId: 'duoc-uc',
            rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
            areaId: 'no-existe',
          },
          'corr-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Responsable (RF-05)', () => {
    const responsable = {
      id: 'responsable-1',
      identificacion: '11.111.111-1',
      nombre: 'Ana Soto',
      cargo: null,
      areaId: 'area-1',
      correo: null,
      telefono: null,
      estado: 'activo',
    };
    const postResponsableRequest = {
      correlationId: 'corr-1',
      operadorId: 'op-admin',
      organizacionId: 'duoc-uc',
      rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
      identificacion: '11.111.111-1',
      nombre: 'Ana Soto',
      areaId: 'area-1',
    };

    it('getResponsables llama a GET {baseUrl}/responsables con areaId y paginacion', async () => {
      axiosGet.mockResolvedValue(
        buildAxiosResponse({ responsables: [responsable], total: 1 }),
      );

      await service.getResponsables(
        'area-1',
        { limit: 20, offset: 0 },
        'corr-1',
      );

      expect(axiosGet).toHaveBeenCalledWith('http://core:3001/responsables', {
        params: { areaId: 'area-1', limit: 20, offset: 0 },
        headers: {
          'x-internal-service-token': 'secreto-compartido',
          'x-correlation-id': 'corr-1',
        },
      });
    });

    it('postResponsable llama a POST {baseUrl}/responsables y devuelve el responsable creado', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse(responsable));

      await expect(
        service.postResponsable(postResponsableRequest, 'corr-1'),
      ).resolves.toEqual(responsable);
    });

    it('postResponsable propaga un 409 de CORE como ConflictException', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(409, { message: 'identificacion duplicada' }),
      );

      await expect(
        service.postResponsable(postResponsableRequest, 'corr-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('patchResponsableEstado llama a PATCH {baseUrl}/responsables/:id/estado y devuelve el responsable actualizado', async () => {
      const inactivo = { ...responsable, estado: 'inactivo' };
      axiosPatch.mockResolvedValue(buildAxiosResponse(inactivo));

      const patchRequest = {
        correlationId: 'corr-1',
        operadorId: 'op-admin',
        organizacionId: 'duoc-uc',
        rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
        estado: 'inactivo' as const,
      };

      await expect(
        service.patchResponsableEstado('responsable-1', patchRequest, 'corr-1'),
      ).resolves.toEqual(inactivo);
      expect(axiosPatch).toHaveBeenCalledWith(
        'http://core:3001/responsables/responsable-1/estado',
        patchRequest,
        expect.anything(),
      );
    });

    it('patchResponsableEstado propaga un 404 de CORE como NotFoundException', async () => {
      axiosPatch.mockRejectedValue(
        buildAxiosError(404, { message: "No existe el responsable 'x'" }),
      );

      await expect(
        service.patchResponsableEstado(
          'no-existe',
          {
            correlationId: 'corr-1',
            operadorId: 'op-admin',
            organizacionId: 'duoc-uc',
            rolesPorOrganizacion: { 'duoc-uc': ['administrador-patrimonial'] },
            estado: 'inactivo',
          },
          'corr-1',
        ),
      ).rejects.toThrow(NotFoundException);
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
