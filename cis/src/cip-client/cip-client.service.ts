import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, type AxiosResponse } from 'axios';
import type { ZodType } from 'zod';
import { CIP_CIRCUIT_BREAKER, CIP_CLIENT_CONFIG } from './cip-client.constants';
import type { CipClientConfig } from './cip-client.config';
import {
  CircuitBreaker,
  CircuitOpenError,
} from '../core-client/circuit-breaker';
import { withRetry } from '../core-client/retry';
import {
  areasResponseSchema,
  categoriasResponseSchema,
  coberturaResponseSchema,
  estadoActivosResponseSchema,
  fueraDeAreaResponseSchema,
  incidenciasResponseSchema,
  noLocalizadosResponseSchema,
  sesionesResponseSchema,
  type AreasResult,
  type CategoriasResult,
  type CoberturaResult,
  type EstadoActivosResult,
  type FueraDeAreaResult,
  type IncidenciasResult,
  type NoLocalizadosResult,
  type Paginacion,
  type SesionesResult,
} from './cip-client.types';
import { CORRELATION_ID_HEADER } from '../common/correlation-id/correlation-id.constants';

// Debe coincidir exactamente con cip/src/common/auth/service-token.guard.ts — mismo caso ya
// aceptado en core-client.service.ts (sin paquete compartido entre servicios todavía).
const SERVICE_TOKEN_HEADER = 'x-internal-service-token';

// Mismos parámetros conservadores que CoreClientService (WAF 4) — CIS→CIP es, igual que CIS→CORE,
// una llamada síncrona dentro del camino de respuesta a un operador de WEB (DOC-019 3), a
// diferencia de CIP→CORE (DOC-018 3, deliberadamente sin retry/breaker porque ahí el llamador es
// un worker de pg-boss que ya reintenta el job completo, ADR-005).
const CIP_RETRY_MAX_ATTEMPTS = 3;
const CIP_RETRY_BASE_DELAY_MS = 200;

function isTransientCipError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }
  return error.response === undefined || error.response.status >= 500;
}

@Injectable()
export class CipClientService {
  constructor(
    @Inject(CIP_CLIENT_CONFIG) private readonly config: CipClientConfig,
    @Inject(CIP_CIRCUIT_BREAKER) private readonly breaker: CircuitBreaker,
    private readonly httpService: HttpService,
  ) {}

  async getCobertura(
    organizacionId: string,
    correlationId: string,
  ): Promise<CoberturaResult> {
    const data = await this.get(
      '/dashboard/cobertura',
      { organizacionId },
      correlationId,
    );
    return this.parse(coberturaResponseSchema, data, 'dashboard/cobertura');
  }

  async getAreas(
    organizacionId: string,
    correlationId: string,
  ): Promise<AreasResult> {
    const data = await this.get(
      '/dashboard/areas',
      { organizacionId },
      correlationId,
    );
    return this.parse(areasResponseSchema, data, 'dashboard/areas');
  }

  async getSesiones(
    organizacionId: string,
    areaId: string | undefined,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<SesionesResult> {
    const data = await this.get(
      '/dashboard/sesiones',
      {
        organizacionId,
        areaId,
        limit: paginacion.limit,
        offset: paginacion.offset,
      },
      correlationId,
    );
    return this.parse(sesionesResponseSchema, data, 'dashboard/sesiones');
  }

  async getFueraDeArea(
    organizacionId: string,
    areaId: string | undefined,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<FueraDeAreaResult> {
    const data = await this.get(
      '/dashboard/fuera-de-area',
      {
        organizacionId,
        areaId,
        limit: paginacion.limit,
        offset: paginacion.offset,
      },
      correlationId,
    );
    return this.parse(
      fueraDeAreaResponseSchema,
      data,
      'dashboard/fuera-de-area',
    );
  }

  async getNoLocalizados(
    organizacionId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<NoLocalizadosResult> {
    const data = await this.get(
      '/dashboard/no-localizados',
      { organizacionId, limit: paginacion.limit, offset: paginacion.offset },
      correlationId,
    );
    return this.parse(
      noLocalizadosResponseSchema,
      data,
      'dashboard/no-localizados',
    );
  }

  async getIncidencias(
    organizacionId: string,
    codigoQr: string | undefined,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<IncidenciasResult> {
    const data = await this.get(
      '/dashboard/incidencias',
      {
        organizacionId,
        codigoQr,
        limit: paginacion.limit,
        offset: paginacion.offset,
      },
      correlationId,
    );
    return this.parse(incidenciasResponseSchema, data, 'dashboard/incidencias');
  }

  async getEstadoActivos(
    organizacionId: string,
    correlationId: string,
  ): Promise<EstadoActivosResult> {
    const data = await this.get(
      '/dashboard/estado-activos',
      { organizacionId },
      correlationId,
    );
    return this.parse(
      estadoActivosResponseSchema,
      data,
      'dashboard/estado-activos',
    );
  }

  async getCategorias(
    organizacionId: string,
    areaId: string | undefined,
    correlationId: string,
  ): Promise<CategoriasResult> {
    const data = await this.get(
      '/dashboard/categorias',
      { organizacionId, areaId },
      correlationId,
    );
    return this.parse(categoriasResponseSchema, data, 'dashboard/categorias');
  }

  private async get(
    path: string,
    params: Record<string, string | number | undefined>,
    correlationId: string,
  ): Promise<unknown> {
    return this.callCip(path, correlationId, () =>
      this.httpService.axiosRef.get(`${this.config.baseUrl}${path}`, {
        params,
        headers: this.headers(correlationId),
      }),
    );
  }

  private headers(correlationId: string): Record<string, string> {
    return {
      [SERVICE_TOKEN_HEADER]: this.config.serviceToken,
      [CORRELATION_ID_HEADER]: correlationId,
    };
  }

  // Único punto por el que CIS le habla a CIP — mismo criterio de reintentos + circuit breaker
  // que CoreClientService.callCore (WAF 4). Todos los endpoints de CIP son lectura pura (RF-09
  // de ccp/, sin escritura), así que no hay passthroughStatuses que distinguir: cualquier error de
  // CIP se colapsa a 502, igual que CoreClientService hace por default para getEntitlements/
  // getCatalogo.
  private async callCip(
    path: string,
    correlationId: string,
    request: () => Promise<AxiosResponse>,
  ): Promise<unknown> {
    try {
      const response = await this.breaker.execute(() =>
        withRetry(request, {
          maxAttempts: CIP_RETRY_MAX_ATTEMPTS,
          baseDelayMs: CIP_RETRY_BASE_DELAY_MS,
          shouldRetry: isTransientCipError,
        }),
      );
      return response.data;
    } catch (error: unknown) {
      if (error instanceof CircuitOpenError) {
        throw new BadGatewayException({
          message: `CIP no disponible (circuito abierto) al pedir ${path}`,
        });
      }
      // DOC-014 8 / ARQUITECTURA-WAF.md 8: CIP puede degradar (alDia=false) o estar caído sin
      // afectar la disponibilidad del resto del ecosistema — un fallo acá siempre es un 502
      // aislado al módulo Dashboard, nunca se expone el detalle interno.
      throw new BadGatewayException({
        message: `No se pudo resolver ${path} contra CIP`,
      });
    }
  }

  private parse<T>(schema: ZodType<T>, data: unknown, label: string): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success || parsed.data === undefined) {
      throw new BadGatewayException({
        message: `CIP devolvió una respuesta de ${label} con forma inesperada`,
      });
    }
    return parsed.data;
  }
}
