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

// Zitadel modela un solo UserGrant por (usuario, proyecto, organizacion) — un segundo
// POST .../grants para el mismo trio devuelve 409 "User grant already exists" (verificado real,
// no documentado en la referencia publica). `call()` lo traduce a este error interno para que
// `crearGrant` pueda distinguirlo del resto de fallas (que sí son 502 genérico) y reaccionar
// sumando el rol al grant existente en vez de fallar.
class ZitadelGrantConflictError extends Error {}

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

  // ATENCION: `ListUserGrantsRequest.UserGrantQuery` de la API real de Zitadel NO tiene un query
  // type por org id (verificado real contra Zitadel v2.65 — un `orgIdQuery` como el que este
  // metodo mandaba antes devuelve 400 "UserGrantQuery.Query: value is required", el campo no
  // existe; los unicos filtros de organizacion disponibles son por dominio o nombre, no por id, y
  // el header `x-zitadel-orgid` NO filtra los resultados para un service user con permisos de
  // instancia como el que usa este cliente — devuelve los grants de TODAS las organizaciones sin
  // ese query type). Se filtra acá, en memoria, por el `orgId` que cada grant ya trae en la
  // respuesta — la unica forma correcta de acotar por organizacion con esta API.
  async listarGrants(
    zitadelOrgId: string,
    correlationId: string,
  ): Promise<GrantUsuario[]> {
    const data = await this.post(
      '/management/v1/users/grants/_search',
      {
        queries: [{ projectIdQuery: { projectId: this.config.projectId } }],
      },
      correlationId,
      { orgId: zitadelOrgId },
    );
    const parsed = this.parse(
      listarGrantsResponseSchema,
      data,
      'users/grants/_search',
    );
    return parsed.result
      .filter((grant) => grant.orgId === zitadelOrgId)
      .map((grant) => ({
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
    try {
      await this.post(
        `/management/v1/users/${encodeURIComponent(userId)}/grants`,
        { projectId: this.config.projectId, roleKeys: [rol] },
        correlationId,
        { orgId: zitadelOrgId, translateConflict: true },
      );
    } catch (error: unknown) {
      if (!(error instanceof ZitadelGrantConflictError)) {
        throw error;
      }
      await this.agregarRolAGrantExistente(
        zitadelOrgId,
        userId,
        rol,
        correlationId,
      );
    }
  }

  // El usuario ya tiene un UserGrant en este proyecto+organizacion (ej. un Administrador del
  // Sistema al que ahora tambien se designa Profesional de AFT) — Zitadel exige sumar el rol al
  // grant existente via PUT, no crear uno nuevo via POST.
  private async agregarRolAGrantExistente(
    zitadelOrgId: string,
    userId: string,
    rol: string,
    correlationId: string,
  ): Promise<void> {
    const grant = await this.buscarGrantDeUsuario(
      zitadelOrgId,
      userId,
      correlationId,
    );
    if (!grant) {
      // No debería pasar (Zitadel recién dijo "already exists"), pero si la vista de lectura no
      // lo devuelve todavía (consistencia eventual), no hay nada seguro que actualizar.
      throw new BadGatewayException({
        message: `Zitadel reportó un grant existente para el usuario '${userId}' pero no se pudo encontrar al buscarlo`,
      });
    }
    if (grant.roles.includes(rol)) {
      return; // ya tiene el rol — idempotente, nada que hacer.
    }
    await this.put(
      `/management/v1/users/${encodeURIComponent(userId)}/grants/${encodeURIComponent(grant.grantId)}`,
      { roleKeys: [...grant.roles, rol] },
      correlationId,
      { orgId: zitadelOrgId },
    );
  }

  private async buscarGrantDeUsuario(
    zitadelOrgId: string,
    userId: string,
    correlationId: string,
  ): Promise<{ grantId: string; roles: string[] } | null> {
    const data = await this.post(
      '/management/v1/users/grants/_search',
      {
        queries: [
          { projectIdQuery: { projectId: this.config.projectId } },
          { userIdQuery: { userId } },
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
    const grant = parsed.result.find((g) => g.orgId === zitadelOrgId);
    if (!grant) {
      return null;
    }
    return { grantId: grant.id, roles: grant.roleKeys };
  }

  private async post(
    path: string,
    body: unknown,
    correlationId: string,
    options: { orgId?: string; translateConflict?: boolean } = {},
  ): Promise<unknown> {
    return this.call(
      path,
      correlationId,
      () =>
        this.httpService.axiosRef.post(`${this.config.issuer}${path}`, body, {
          headers: this.headers(correlationId, options.orgId),
        }),
      options.translateConflict ?? false,
    );
  }

  private async put(
    path: string,
    body: unknown,
    correlationId: string,
    options: { orgId?: string } = {},
  ): Promise<unknown> {
    return this.call(path, correlationId, () =>
      this.httpService.axiosRef.put(`${this.config.issuer}${path}`, body, {
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
    translateConflict = false,
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
      // Solo la creación de grants (crearGrant) espera y maneja este caso puntual — el resto de
      // las llamadas (búsquedas) nunca deberían recibir un 409 real, así que ahí se deja caer al
      // 502 genérico de abajo en vez de arriesgar que ZitadelGrantConflictError se escape sin
      // capturar.
      if (
        translateConflict &&
        error instanceof AxiosError &&
        error.response?.status === 409
      ) {
        throw new ZitadelGrantConflictError();
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
