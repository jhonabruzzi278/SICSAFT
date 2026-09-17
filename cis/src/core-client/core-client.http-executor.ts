import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, type AxiosResponse } from 'axios';
import type { ZodType } from 'zod';
import type { CoreClientConfig } from './core-client.config';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';
import { withRetry } from './retry';
import { CORRELATION_ID_HEADER } from '../common/correlation-id/correlation-id.constants';

// Debe coincidir exactamente con core/src/common/auth/service-token.guard.ts — no hay paquete
// compartido entre CIS y CORE todavia (mismo caso que Organizacion/Sede en core-client.types.ts).
const SERVICE_TOKEN_HEADER = 'x-internal-service-token';

// WAF 4: parametros conservadores para el trafico actual, igual criterio que
// CORE_CIRCUIT_BREAKER en core-client.module.ts. 3 intentos totales, 200ms/400ms de backoff.
const CORE_RETRY_MAX_ATTEMPTS = 3;
const CORE_RETRY_BASE_DELAY_MS = 200;

// Solo reintenta lo transitorio: sin respuesta (red caida/timeout) o 5xx. Un 400/404/409 es un
// rechazo permanente del lado de CORE (DOC-002 5) — reintentarlo no cambia el resultado.
function isTransientCoreError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }
  return error.response === undefined || error.response.status >= 500;
}

export interface CallOptions {
  passthroughStatuses?: number[];
}

// Unico punto por el que CIS le habla a CORE (GET/POST/PATCH/DELETE + parseo de la respuesta) —
// cada archivo core-client.<dominio>.ts recibe una instancia de esto en vez de duplicar retries,
// circuit breaker y mapeo de errores por dominio. Antes vivia como métodos privados de
// CoreClientService; se extrajo para que esa clase quede como una fachada delgada y cada dominio
// (Activos, Catálogo, Importaciones, Inventarios, Auditoría, Estructura) tenga su propio archivo.
export class CoreHttpExecutor {
  constructor(
    private readonly config: CoreClientConfig,
    private readonly breaker: CircuitBreaker,
    private readonly httpService: HttpService,
  ) {}

  async get(
    path: string,
    params: Record<string, string | number | undefined> | undefined,
    correlationId: string,
  ): Promise<unknown> {
    return this.callCore(path, correlationId, () =>
      this.httpService.axiosRef.get(`${this.config.baseUrl}${path}`, {
        params,
        headers: this.headers(correlationId),
      }),
    );
  }

  async post(
    path: string,
    body: unknown,
    correlationId: string,
    options: CallOptions = { passthroughStatuses: [400, 409] },
  ): Promise<unknown> {
    return this.callCore(
      path,
      correlationId,
      () =>
        this.httpService.axiosRef.post(`${this.config.baseUrl}${path}`, body, {
          headers: this.headers(correlationId),
        }),
      options,
    );
  }

  async patch(
    path: string,
    body: unknown,
    correlationId: string,
    options: CallOptions,
  ): Promise<unknown> {
    return this.callCore(
      path,
      correlationId,
      () =>
        this.httpService.axiosRef.patch(`${this.config.baseUrl}${path}`, body, {
          headers: this.headers(correlationId),
        }),
      options,
    );
  }

  // DOC-021 3 — primer DELETE de este cliente (documentos_activo admite baja real, a diferencia
  // del resto de recursos oficiales). El body va en `options.data` (axios), mismo patron que
  // post/patch para transportar operadorId/rolesPorOrganizacion.
  async delete(
    path: string,
    body: unknown,
    correlationId: string,
    options: CallOptions,
  ): Promise<unknown> {
    return this.callCore(
      path,
      correlationId,
      () =>
        this.httpService.axiosRef.delete(`${this.config.baseUrl}${path}`, {
          data: body,
          headers: this.headers(correlationId),
        }),
      options,
    );
  }

  parse<T>(schema: ZodType<T>, data: unknown, label: string): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success || parsed.data === undefined) {
      throw new BadGatewayException({
        message: `CORE devolvió una respuesta de ${label} con forma inesperada`,
      });
    }
    return parsed.data;
  }

  private headers(correlationId: string): Record<string, string> {
    return {
      [SERVICE_TOKEN_HEADER]: this.config.serviceToken,
      [CORRELATION_ID_HEADER]: correlationId,
    };
  }

  // Pasa siempre por reintentos con backoff y luego por el circuit breaker (WAF 4: "reintentos
  // con backoff exponencial + limite de intentos" + "si un sistema externo empieza a fallar, el
  // CIS deja de insistir temporalmente"). Reintentar es seguro para las 4 operaciones, incluido
  // POST /inventarios: CORE dedupea por idempotencyKey (DOC-006 3,
  // sesiones_inventario.idempotency_key UNIQUE) — reintentar una request ya aceptada devuelve la
  // misma fila, nunca duplica (WAF 4: "reintentar una operacion de red nunca duplica un alta"). El
  // breaker envuelve la secuencia completa de reintentos: cada request logica cuenta una sola vez
  // para el umbral de fallos consecutivos, no una vez por intento interno.
  private async callCore(
    path: string,
    correlationId: string,
    request: () => Promise<AxiosResponse>,
    options: CallOptions = {},
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
      // DOC-002 5: 5xx/timeout/sin red es transitorio, no un bug del cliente — se propaga como
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
    if (status === 403) {
      return new ForbiddenException(body);
    }
    // 404 se incluyo explicitamente en passthroughStatuses para varios endpoints nuevos de
    // DOC-021 3 (activos/:id/baja, /reincorporacion, /responsable, /descripcion, /documentos) —
    // sin este caso, cualquiera de esos 404 caia en el default de abajo y se propagaba como
    // ConflictException (409), un bug real encontrado al escribir la cobertura unitaria de estos
    // endpoints (a diferencia de patchContrato/patchResponsableEstado, que no listan 404 en
    // passthroughStatuses y dependen del chequeo explicito de 404 mas abajo en callCore).
    if (status === 404) {
      return new NotFoundException(body);
    }
    return new ConflictException(body);
  }
}
