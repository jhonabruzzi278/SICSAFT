import { BadGatewayException, NotFoundException } from '@nestjs/common';
import type { HttpService } from '@nestjs/axios';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { ZitadelAdminService } from './zitadel-admin.service';
import type { ZitadelAdminConfig } from './zitadel-admin.config';
import {
  CircuitBreaker,
  CircuitOpenError,
} from '../core-client/circuit-breaker';

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

// Sin `.response` — asi lanza axios real ante ECONNREFUSED/timeout.
function buildAxiosNetworkError(): AxiosError {
  return new AxiosError('ECONNREFUSED', AxiosError.ERR_NETWORK);
}

describe('ZitadelAdminService', () => {
  const config: ZitadelAdminConfig = {
    issuer: 'http://zitadel:8080',
    token: 'pat-secreto',
    projectId: 'proyecto-cis',
  };
  let axiosPost: jest.Mock;
  let httpService: HttpService;
  let breaker: CircuitBreaker;
  let service: ZitadelAdminService;

  beforeEach(() => {
    jest.useFakeTimers();
    axiosPost = jest.fn();
    httpService = {
      axiosRef: { post: axiosPost },
    } as unknown as HttpService;
    // Umbral alto: en estos tests un solo fallo nunca debe abrir el circuito por accidente.
    breaker = new CircuitBreaker({ failureThreshold: 100, resetTimeoutMs: 1 });
    service = new ZitadelAdminService(config, breaker, httpService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('buscarUsuarioPorEmail', () => {
    it('llama a POST {issuer}/management/v1/users/_search con la query por email y los headers esperados', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ result: [] }));

      await service.buscarUsuarioPorEmail('usuario@duoc.cl', 'corr-1');

      expect(axiosPost).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/_search',
        {
          queries: [
            {
              emailQuery: {
                emailAddress: 'usuario@duoc.cl',
                method: 'TEXT_QUERY_METHOD_EQUALS',
              },
            },
          ],
        },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
          },
        },
      );
    });

    it('devuelve null cuando Zitadel no encuentra ningun usuario con ese email', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ result: [] }));

      await expect(
        service.buscarUsuarioPorEmail('nadie@duoc.cl', 'corr-1'),
      ).resolves.toBeNull();
    });

    it('devuelve el usuario mapeado cuando Zitadel encuentra una coincidencia', async () => {
      axiosPost.mockResolvedValue(
        buildAxiosResponse({
          result: [
            {
              id: 'usuario-1',
              human: {
                profile: { displayName: 'Usuario Uno' },
                email: { email: 'usuario@duoc.cl' },
              },
            },
          ],
        }),
      );

      await expect(
        service.buscarUsuarioPorEmail('usuario@duoc.cl', 'corr-1'),
      ).resolves.toEqual({
        id: 'usuario-1',
        email: 'usuario@duoc.cl',
        displayName: 'Usuario Uno',
      });
    });

    it('usa null para email/displayName cuando el usuario no trae datos de human', async () => {
      axiosPost.mockResolvedValue(
        buildAxiosResponse({ result: [{ id: 'usuario-2' }] }),
      );

      await expect(
        service.buscarUsuarioPorEmail('usuario2@duoc.cl', 'corr-1'),
      ).resolves.toEqual({
        id: 'usuario-2',
        email: null,
        displayName: null,
      });
    });

    it('lanza 502 si Zitadel responde una forma inesperada', async () => {
      // `result` tiene default([]), asi que solo un tipo invalido (no faltante) rompe el schema.
      axiosPost.mockResolvedValue(
        buildAxiosResponse({ result: 'no-es-un-array' }),
      );

      await expect(
        service.buscarUsuarioPorEmail('usuario@duoc.cl', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('listarGrants', () => {
    it('llama a POST {issuer}/management/v1/users/grants/_search con orgId/projectId y el header x-zitadel-orgid', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({ result: [] }));

      await service.listarGrants('zitadel-org-1', 'corr-1');

      expect(axiosPost).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/grants/_search',
        {
          queries: [
            { orgIdQuery: { orgId: 'zitadel-org-1' } },
            { projectIdQuery: { projectId: 'proyecto-cis' } },
          ],
        },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
            'x-zitadel-orgid': 'zitadel-org-1',
          },
        },
      );
    });

    it('devuelve los grants mapeados cuando Zitadel responde una forma valida', async () => {
      axiosPost.mockResolvedValue(
        buildAxiosResponse({
          result: [
            {
              userId: 'usuario-1',
              orgId: 'zitadel-org-1',
              projectId: 'proyecto-cis',
              roleKeys: ['administrador-patrimonial'],
              email: 'usuario@duoc.cl',
              displayName: 'Usuario Uno',
            },
          ],
        }),
      );

      await expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).resolves.toEqual([
        {
          userId: 'usuario-1',
          email: 'usuario@duoc.cl',
          displayName: 'Usuario Uno',
          roles: ['administrador-patrimonial'],
        },
      ]);
    });

    it('usa null para email/displayName y [] para roles cuando Zitadel no los trae', async () => {
      axiosPost.mockResolvedValue(
        buildAxiosResponse({
          result: [
            {
              userId: 'usuario-2',
              orgId: 'zitadel-org-1',
              projectId: 'proyecto-cis',
            },
          ],
        }),
      );

      await expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).resolves.toEqual([
        {
          userId: 'usuario-2',
          email: null,
          displayName: null,
          roles: [],
        },
      ]);
    });

    it('lanza 502 si la request a Zitadel falla (red/timeout/5xx) tras agotar los reintentos', async () => {
      axiosPost.mockRejectedValue(buildAxiosNetworkError());

      const assertion = expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
      await jest.advanceTimersByTimeAsync(200); // backoff del 1er reintento
      await jest.advanceTimersByTimeAsync(400); // backoff del 2do reintento (exponencial)
      await assertion;

      // WAF 4: reintentos con backoff, 3 intentos totales, mismo criterio que CoreClientService.
      expect(axiosPost).toHaveBeenCalledTimes(3);
    });

    it('no reintenta si el error no es un AxiosError (bug inesperado del cliente HTTP)', async () => {
      axiosPost.mockRejectedValue(
        new Error('bug inesperado, no deberia pasar'),
      );

      await expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('propaga un 404 de Zitadel como NotFoundException, sin reintentar', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(404, { message: 'organizacion inexistente' }),
      );

      await expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).rejects.toThrow(NotFoundException);
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('propaga un 400 de Zitadel como BadGatewayException, sin exponer el detalle interno', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(400, { message: 'detalle interno de zitadel' }),
      );

      await expect(
        service.listarGrants('zitadel-org-1', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });

    it('cuando el circuito esta abierto, lanza 502 sin llamar a axios', async () => {
      const breakerAbierto = {
        execute: jest.fn().mockRejectedValue(new CircuitOpenError()),
      } as unknown as CircuitBreaker;
      const serviceConCircuitoAbierto = new ZitadelAdminService(
        config,
        breakerAbierto,
        httpService,
      );

      await expect(
        serviceConCircuitoAbierto.listarGrants('zitadel-org-1', 'corr-1'),
      ).rejects.toThrow(BadGatewayException);
      expect(axiosPost).not.toHaveBeenCalled();
    });
  });

  describe('crearGrant', () => {
    it('llama a POST {issuer}/management/v1/users/:userId/grants con projectId/roleKeys y el header x-zitadel-orgid', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({}));

      await service.crearGrant(
        'zitadel-org-1',
        'usuario-1',
        'administrador-patrimonial',
        'corr-1',
      );

      expect(axiosPost).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/usuario-1/grants',
        {
          projectId: 'proyecto-cis',
          roleKeys: ['administrador-patrimonial'],
        },
        {
          headers: {
            Authorization: 'Bearer pat-secreto',
            'x-correlation-id': 'corr-1',
            'x-zitadel-orgid': 'zitadel-org-1',
          },
        },
      );
    });

    it('escapa el userId al armar la URL', async () => {
      axiosPost.mockResolvedValue(buildAxiosResponse({}));

      await service.crearGrant(
        'zitadel-org-1',
        'usuario con espacio',
        'directivo',
        'corr-1',
      );

      expect(axiosPost).toHaveBeenCalledWith(
        'http://zitadel:8080/management/v1/users/usuario%20con%20espacio/grants',
        expect.anything(),
        expect.anything(),
      );
    });

    it('propaga un 404 de Zitadel como NotFoundException (usuario inexistente), sin reintentar', async () => {
      axiosPost.mockRejectedValue(
        buildAxiosError(404, { message: 'usuario inexistente' }),
      );

      await expect(
        service.crearGrant('zitadel-org-1', 'no-existe', 'directivo', 'corr-1'),
      ).rejects.toThrow(NotFoundException);
      expect(axiosPost).toHaveBeenCalledTimes(1);
    });
  });
});
