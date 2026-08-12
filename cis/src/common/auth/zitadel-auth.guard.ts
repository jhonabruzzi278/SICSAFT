import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ZITADEL_AUTH_CONFIG, ZITADEL_JWKS } from './zitadel-auth.constants';
import type { ZitadelAuthConfig } from './zitadel-auth.config';

export interface ZitadelAuthContext {
  // `sub` del token — el operador ya fue autenticado por Zitadel, el CIS no valida credenciales.
  operadorId: string;
  // Pass-through del mismo token validado — el cliente lo sigue usando en llamadas posteriores,
  // el CIS no emite un token propio (ver ADR-002: "el CIS, no el token" valida, no reemplaza).
  accessToken: string;
  expiresAt: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: ZitadelAuthContext;
}

// El guard siempre setea `request.auth` antes de dejar pasar la request (o lanza 401) — este
// helper existe para que los controllers no necesiten un non-null assertion para leerlo.
export function requireAuthContext(
  request: AuthenticatedRequest,
): ZitadelAuthContext {
  if (!request.auth) {
    throw new UnauthorizedException('No hay contexto de autenticación');
  }
  return request.auth;
}

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class ZitadelAuthGuard implements CanActivate {
  constructor(
    @Inject(ZITADEL_AUTH_CONFIG) private readonly config: ZitadelAuthConfig,
    @Inject(ZITADEL_JWKS) private readonly jwks: JWTVerifyGetKey,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    const { payload } = await this.verify(token);

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new UnauthorizedException('El token no trae `sub`');
    }
    if (typeof payload.exp !== 'number') {
      throw new UnauthorizedException('El token no trae `exp`');
    }

    request.auth = {
      operadorId: payload.sub,
      accessToken: token,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
    return true;
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
      // No se expone la causa (firma invalida vs vencido vs issuer/audience distinto) — DOC-002
      // §5 solo distingue un 401 generico para el cliente, y no filtrar el detalle evita dar
      // pistas utiles a un atacante sobre por que fallo la verificacion.
      throw new UnauthorizedException('Token inválido o vencido');
    }
  }
}
