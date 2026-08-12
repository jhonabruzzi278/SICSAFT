import { BadGatewayException } from '@nestjs/common';
import type { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosHeaders, type AxiosResponse } from 'axios';
import { CoreClientService } from './core-client.service';
import type { CoreClientConfig } from './core-client.config';

function buildAxiosResponse(data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

describe('CoreClientService', () => {
  const config: CoreClientConfig = { baseUrl: 'http://core:3001' };
  let httpService: jest.Mocked<Pick<HttpService, 'get'>>;
  let service: CoreClientService;

  beforeEach(() => {
    httpService = { get: jest.fn() };
    service = new CoreClientService(config, httpService as HttpService);
  });

  it('llama a GET {baseUrl}/entitlements con operadorId como query param', async () => {
    httpService.get.mockReturnValue(
      of(buildAxiosResponse({ organizaciones: [] })),
    );

    await service.getEntitlements('op-1');

    expect(httpService.get).toHaveBeenCalledWith(
      'http://core:3001/entitlements',
      { params: { operadorId: 'op-1' } },
    );
  });

  it('devuelve las organizaciones cuando CORE responde una forma valida', async () => {
    const organizaciones = [
      {
        id: 'duoc-uc',
        nombre: 'DUOC UC',
        sedes: [{ id: 'melipilla', nombre: 'Melipilla' }],
      },
    ];
    httpService.get.mockReturnValue(of(buildAxiosResponse({ organizaciones })));

    const result = await service.getEntitlements('op-1');

    expect(result).toEqual({ organizaciones });
  });

  it('lanza 502 si la request a CORE falla (red/timeout/5xx)', async () => {
    httpService.get.mockReturnValue(
      throwError(() => new Error('ECONNREFUSED')),
    );

    await expect(service.getEntitlements('op-1')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('lanza 502 si CORE responde una forma inesperada', async () => {
    httpService.get.mockReturnValue(
      of(buildAxiosResponse({ algoDistinto: true })),
    );

    await expect(service.getEntitlements('op-1')).rejects.toThrow(
      BadGatewayException,
    );
  });
});
