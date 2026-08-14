import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, type AxiosResponse } from 'axios';
import type { ZodType } from 'zod';
import {
  CORE_CIRCUIT_BREAKER,
  CORE_CLIENT_CONFIG,
} from './core-client.constants';
import type { CoreClientConfig } from './core-client.config';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { withRetry } from './retry';
import {
  catalogoResponseSchema,
  entitlementsResponseSchema,
  inventarioEstadoResponseSchema,
  postInventarioResponseSchema,
  type CatalogoResult,
  type EntitlementsResult,
  type InventarioEstadoResult,
  type PostInventarioResult,
} from './core-client.types';
import { CORRELATION_ID_HEADER } from '../common/correlation-id/correlation-id.constants';
import type {
  CatalogoQuery,
  InventarioRequest,
} from '../qr-connector/qr-connector.schemas';

// Debe coincidir exactamente con core/src/common/auth/service-token.guard.ts — no hay paquete
// compartido entre CIS y CORE todavia (mismo caso que Organizacion/Sede en core-client.types.ts).
const SERVICE_TOKEN_HEADER = 'x-internal-service-token';

// WAF §4: parametros conservadores para el trafico actual, igual criterio que
// CORE_CIRCUIT_BREAKER en core-client.module.ts. 3 intentos totales, 200ms/400ms de backoff.
const CORE_RETRY_MAX_ATTEMPTS = 3;
const CORE_RETRY_BASE_DELAY_MS = 200;

// Solo reintenta lo transitorio: sin respuesta (red caida/timeout) o 5xx. Un 400/404/409 es un
// rechazo permanente del lado de CORE (DOC-002 §5) — reintentarlo no cambia el resultado.
function isTransientCoreError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }
  return error.response === undefined || error.response.status >= 500;
}

@Injectable()
export class CoreClientService {
  constructor(
    @Inject(CORE_CLIENT_CONFIG) private readonly config: CoreClientConfig,
    @Inject(CORE_CIRCUIT_BREAKER) private readonly breaker: CircuitBreaker,
    private readonly httpService: HttpService,
  ) {}

  async getEntitlements(
    operadorId: string,
    correlationId: string,
  ): Promise<EntitlementsResult> {
    const data = await this.get('/entitlements', { operadorId }, correlationId);
    return this.parse(entitlementsResponseSchema, data, 'entitlements');
  }

  // DOC-006 §2 — reemplaza SEED_CATALOGO (ROADMAP.md Fase 3).
  async getCatalogo(
    query: CatalogoQuery,
    correlationId: string,
  ): Promise<CatalogoResult> {
    const data = await this.get('/catalogo', query, correlationId);
    return this.parse(catalogoResponseSchema, data, 'catalogo');
  }

  // DOC-006 §3 — reemplaza los Map en memoria de QrConnectorService. A diferencia de
  // getEntitlements/getCatalogo, acá SI se propaga el error de CORE (400/409) tal cual en vez de
  // colapsarlo a 502 — DOC-002 §5 exige que el cliente pueda distinguir "rechazado, no
  // reintentar" (400/409) de "transitorio, reintentar" (5xx/timeout/circuito abierto).
  async postInventario(
    request: InventarioRequest,
    correlationId: string,
  ): Promise<PostInventarioResult> {
    const data = await this.post('/inventarios', request, correlationId);
    return this.parse(postInventarioResponseSchema, data, 'inventarios');
  }

  async getInventarioEstado(
    inventarioId: string,
    correlationId: string,
  ): Promise<InventarioEstadoResult> {
    const data = await this.get(
      `/inventarios/${encodeURIComponent(inventarioId)}/estado`,
      undefined,
      correlationId,
    );
    return this.parse(
      inventarioEstadoResponseSchema,
      data,
      'inventarios/estado',
    );
  }

  private async get(
    path: string,
    params: Record<string, string | undefined> | undefined,
    correlationId: string,
  ): Promise<unknown> {
    return this.callCore(path, correlationId, () =>
      this.httpService.axiosRef.get(`${this.config.baseUrl}${path}`, {
        params,
        headers: this.headers(correlationId),
      }),
    );
  }

  private async post(
    path: string,
    body: unknown,
    correlationId: string,
  ): Promise<unknown> {
    return this.callCore(
      path,
      correlationId,
      () =>
        this.httpService.axiosRef.post(`${this.config.baseUrl}${path}`, body, {
          headers: this.headers(correlationId),
        }),
      { passthroughStatuses: [400, 409] },
    );
  }

  private headers(correlationId: string): Record<string, string> {
    return {
      [SERVICE_TOKEN_HEADER]: this.config.serviceToken,
      [CORRELATION_ID_HEADER]: correlationId,
    };
  }

  // Unico punto por el que CIS le habla a CORE — pasa siempre por reintentos con backoff y luego
  // por el circuit breaker (WAF §4: "reintentos con backoff exponencial + limite de intentos" +
  // "si un sistema externo empieza a fallar, el CIS deja de insistir temporalmente"). Reintentar
  // es seguro para las 4 operaciones, incluido POST /inventarios: CORE dedupea por
  // idempotencyKey (DOC-006 §3, sesiones_inventario.idempotency_key UNIQUE) — reintentar una
  // request ya aceptada devuelve la misma fila, nunca duplica (WAF §4: "reintentar una operacion
  // de red nunca duplica un alta"). El breaker envuelve la secuencia completa de reintentos: cada
  // request logica cuenta una sola vez para el umbral de fallos consecutivos, no una vez por
  // intento interno.
  private async callCore(
    path: string,
    correlationId: string,
    request: () => Promise<AxiosResponse>,
    options: { passthroughStatuses?: number[] } = {},
  ): Promise<unknown> {
    try {
      const response = await this.breaker.execute(() =>
        withRetry(request, {
          maxAttempts: CORE_RETRY_MAX_ATTEMPTS,
          baseDelayMs: CORE_RETRY_BASE_DELAY_MS,
          shouldRetry: isTransientCoreError,
        }),
      );
      return response.data;
    } catch (error: unknown) {
      if (error instanceof CircuitOpenError) {
        throw new BadGatewayException({
          message: `CORE no disponible (circuito abierto) al pedir ${path}`,
        });
      }
      if (
        error instanceof AxiosError &&
        error.response &&
        options.passthroughStatuses?.includes(error.response.status)
      ) {
        throw this.passthroughError(error.response.status, error.response.data);
      }
      if (error instanceof AxiosError && error.response?.status === 404) {
        throw new NotFoundException(error.response.data);
      }
      // DOC-002 §5: 5xx/timeout/sin red es transitorio, no un bug del cliente — se propaga como
      // 502 para que quien llamo a CIS lo trate igual que cualquier otro error transitorio (la
      // causa exacta no se expone, mismo criterio que ZitadelAuthGuard con el 401).
      throw new BadGatewayException({
        message: `No se pudo resolver ${path} contra CORE`,
      });
    }
  }

  private passthroughError(status: number, body: unknown): Error {
    if (status === 400) {
      return new BadRequestException(body);
    }
    return new ConflictException(body);
  }

  private parse<T>(schema: ZodType<T>, data: unknown, label: string): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success || parsed.data === undefined) {
      throw new BadGatewayException({
        message: `CORE devolvió una respuesta de ${label} con forma inesperada`,
      });
    }
    return parsed.data;
  }
}
