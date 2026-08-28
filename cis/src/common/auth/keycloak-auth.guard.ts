import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { randomUUID } from 'node:crypto';
import {
  KEYCLOAK_AUTH_CONFIG,
  KEYCLOAK_JWKS,
  ROLES_POR_ORGANIZACION_CACHE_TTL_MS,
} from './keycloak-auth.constants';
import type { KeycloakAuthConfig } from './keycloak-auth.config';
import { KeycloakAdminService } from '../../keycloak-admin/keycloak-admin.service';
import type { RequestWithCorrelationId } from '../correlation-id/correlation-id.middleware';

export interface KeycloakAuthContext {
  operadorId: string; // payload.sub
  accessToken: string; // pass-through, CIS no emite token propio
  expiresAt: string; // new Date(payload.exp * 1000).toISOString()
  rolesPorOrganizacion: Record<string, string[]>;
}

export interface AuthenticatedRequest extends Request {
  auth?: KeycloakAuthContext;
}

export function requireAuthContext(
  request: AuthenticatedRequest,
): KeycloakAuthContext {
  if (!request.auth) {
    throw new UnauthorizedException('No hay contexto de autenticación');
  }
  return request.auth;
}

const BEARER_PREFIX = 'Bearer ';

interface CacheEntry {
  valor: Record<string, string[]>;
  expiraEn: number;
}

// ADR-004 — reemplaza a ZitadelAuthGuard. Diferencia real de fondo (no solo de nombre): Zitadel
// firmaba rolesPorOrganizacion directo en el JWT (`urn:zitadel:iam:org:project:roles`); Keycloak
// no tiene equivalente — sus realm roles son globales por usuario, y el claim `organization`
// (mapper `oidc-organization-membership-mapper`) solo dice a qué organizaciones pertenece el
// usuario, no qué rol tiene en cada una (verificado real contra un Keycloak 26.6 de prueba,
// 2026-08-26 — no asumido de la documentación). Este guard resuelve el rol por organización
// llamando a KeycloakAdminService (que lo calcula a partir de los grupos `{organizacionId}::{rol}`
// del usuario, ver keycloak-admin.service.ts) — con una caché corta en memoria del propio proceso
// para no pegarle a Keycloak en cada request. Extiende el mismo principio de ADR-002 ("el punto de
// validación es el CIS, no el token"), ahora también para roles, no solo para sedes/contrato.
@Injectable()
export class KeycloakAuthGuard implements CanActivate {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(KEYCLOAK_AUTH_CONFIG) private readonly config: KeycloakAuthConfig,
    @Inject(KEYCLOAK_JWKS) private readonly jwks: JWTVerifyGetKey,
    private readonly keycloakAdminService: KeycloakAdminService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & Partial<RequestWithCorrelationId>>();
    const token = this.extractBearerToken(request.headers.authorization);
    const { payload } = await this.verify(token);

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new UnauthorizedException('El token no trae `sub`');
    }
    if (typeof payload.exp !== 'number') {
      throw new UnauthorizedException('El token no trae `exp`');
    }

    const organizaciones = this.extractOrganizaciones(payload.organization);
    const correlationId = request.correlationId ?? randomUUID();
    const rolesPorOrganizacion = await this.resolverRolesPorOrganizacion(
      payload.sub,
      organizaciones,
      correlationId,
    );

    request.auth = {
      operadorId: payload.sub,
      accessToken: token,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      rolesPorOrganizacion,
    };
    return true;
  }

  private extractOrganizaciones(claim: unknown): string[] {
    if (!Array.isArray(claim)) {
      return [];
    }
    return claim.filter((valor): valor is string => typeof valor === 'string');
  }

  private async resolverRolesPorOrganizacion(
    operadorId: string,
    organizaciones: string[],
    correlationId: string,
  ): Promise<Record<string, string[]>> {
    if (organizaciones.length === 0) {
      return {};
    }
    const entradaCache = this.cache.get(operadorId);
    if (entradaCache && entradaCache.expiraEn > Date.now()) {
      return entradaCache.valor;
    }
    const valor =
      await this.keycloakAdminService.resolverRolesPorOrganizacionDeUsuario(
        operadorId,
        organizaciones,
        correlationId,
      );
    this.cache.set(operadorId, {
      valor,
      expiraEn: Date.now() + ROLES_POR_ORGANIZACION_CACHE_TTL_MS,
    });
    return valor;
  }

  private extractBearerToken(header: string | undefined): string {
    if (!header?.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException(
        'Falta el header Authorization: Bearer <token>',
      );
    }
    const token = header.slice(BEARER_PREFIX.length).trim();
    if (token.length === 0) {
      throw new UnauthorizedException(
        'Falta el header Authorization: Bearer <token>',
      );
    }
    return token;
  }

  private async verify(token: string) {
    try {
      return await jwtVerify(token, this.jwks, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
    } catch {
      throw new UnauthorizedException('Token inválido o vencido');
    }
  }
}
