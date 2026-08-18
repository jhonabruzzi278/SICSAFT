import {
  BadGatewayException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError, type AxiosResponse } from 'axios';
import type { ZodType } from 'zod';
import {
  ZITADEL_ADMIN_CIRCUIT_BREAKER,
  ZITADEL_ADMIN_CONFIG,
} from './zitadel-admin.constants';
import type { ZitadelAdminConfig } from './zitadel-admin.config';
import {
  CircuitBreaker,
  CircuitOpenError,
} from '../core-client/circuit-breaker';
import { withRetry } from '../core-client/retry';
import {
  buscarUsuariosResponseSchema,
  listarGrantsResponseSchema,
  type GrantUsuario,
  type UsuarioZitadel,
} from './zitadel-admin.types';

// Mismos parametros conservadores que CoreClientService/CipClientService (WAF 4).
const ZITADEL_RETRY_MAX_ATTEMPTS = 3;
const ZITADEL_RETRY_BASE_DELAY_MS = 200;

// Header propio de Zitadel para escopar una llamada de Management API a una organizacion
// especifica cuando el service user que llama no pertenece a ella (nuestro caso: un service user
// administrativo operando sobre cualquier organizacion del ecosistema).
const ZITADEL_ORG_HEADER = 'x-zitadel-orgid';

function isTransientZitadelError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }
  return error.response === undefined || error.response.status >= 500;
}

// DOC-021 4 (Administrador del Sistema) — cliente de la API de administracion de Zitadel
// (`/management/v1/...`), autenticado con un PAT de service user (ver zitadel-admin.config.ts).
// Nunca lo usa CIP/CORE — es exclusivo de CIS, que es quien ya administra la relacion con
// Zitadel para el resto del ecosistema (ZitadelAuthGuard).
@Injectable()
export class ZitadelAdminService {
  constructor(
    @Inject(ZITADEL_ADMIN_CONFIG) private readonly config: ZitadelAdminConfig,
    @Inject(ZITADEL_ADMIN_CIRCUIT_BREAKER)
    private readonly breaker: CircuitBreaker,
    private readonly httpService: HttpService,
  ) {}

  async buscarUsuarioPorEmail(
    email: string,
    correlationId: string,
  ): Promise<UsuarioZitadel | null> {
    const data = await this.post(
      '/management/v1/users/_search',
      {
        queries: [
          {
            emailQuery: {
              emailAddress: email,
              method: 'TEXT_QUERY_METHOD_EQUALS',
            },
          },
        ],
      },
      correlationId,
    );
    const parsed = this.parse(
      buscarUsuariosResponseSchema,
      data,
      'users/_search',
    );
    const usuario = parsed.result[0];
    if (!usuario) {
      return null;
    }
    return {
      id: usuario.id,
      email: usuario.human?.email?.email ?? null,
      displayName: usuario.human?.profile?.displayName ?? null,
    };
  }

  async listarGrants(
    zitadelOrgId: string,
    correlationId: string,
  ): Promise<GrantUsuario[]> {
    const data = await this.post(
      '/management/v1/users/grants/_search',
      {
        queries: [
          { orgIdQuery: { orgId: zitadelOrgId } },
          { projectIdQuery: { projectId: this.config.projectId } },
        ],
      },
      correlationId,
      { orgId: zitadelOrgId },
    );
    const parsed = this.parse(
      listarGrantsResponseSchema,
      data,
      'users/grants/_search',
    );
    return parsed.result.map((grant) => ({
      userId: grant.userId,
      email: grant.email ?? null,
      displayName: grant.displayName ?? null,
      roles: grant.roleKeys,
    }));
  }

  async crearGrant(
    zitadelOrgId: string,
    userId: string,
    rol: string,
    correlationId: string,
  ): Promise<void> {
    await this.post(
      `/management/v1/users/${encodeURIComponent(userId)}/grants`,
      { projectId: this.config.projectId, roleKeys: [rol] },
      correlationId,
      { orgId: zitadelOrgId },
    );
  }

  private async post(
    path: string,
    body: unknown,
    correlationId: string,
    options: { orgId?: string } = {},
  ): Promise<unknown> {
    return this.call(path, correlationId, () =>
      this.httpService.axiosRef.post(`${this.config.issuer}${path}`, body, {
        headers: this.headers(correlationId, options.orgId),
      }),
    );
  }

  private headers(
    correlationId: string,
    orgId?: string,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.token}`,
      'x-correlation-id': correlationId,
      ...(orgId ? { [ZITADEL_ORG_HEADER]: orgId } : {}),
    };
  }

  // Mismo criterio de reintentos + circuit breaker que CoreClientService/CipClientService (WAF
  // 4) — un 404 (usuario/grant inexistente) se traduce, el resto colapsa a 502 sin exponer
  // detalle interno de Zitadel.
  private async call(
    path: string,
    correlationId: string,
    request: () => Promise<AxiosResponse>,
  ): Promise<unknown> {
    try {
      const response = await this.breaker.execute(() =>
        withRetry(request, {
          maxAttempts: ZITADEL_RETRY_MAX_ATTEMPTS,
          baseDelayMs: ZITADEL_RETRY_BASE_DELAY_MS,
          shouldRetry: isTransientZitadelError,
        }),
      );
      return response.data;
    } catch (error: unknown) {
      if (error instanceof CircuitOpenError) {
        throw new BadGatewayException({
          message: `Zitadel no disponible (circuito abierto) al pedir ${path}`,
        });
      }
      if (error instanceof AxiosError && error.response?.status === 404) {
        throw new NotFoundException({
          message: `Zitadel no encontró el recurso en ${path}`,
        });
      }
      throw new BadGatewayException({
        message: `No se pudo resolver ${path} contra la API de administración de Zitadel`,
      });
    }
  }

  private parse<T>(schema: ZodType<T>, data: unknown, label: string): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success || parsed.data === undefined) {
      throw new BadGatewayException({
        message: `Zitadel devolvió una respuesta de ${label} con forma inesperada`,
      });
    }
    return parsed.data;
  }
}
