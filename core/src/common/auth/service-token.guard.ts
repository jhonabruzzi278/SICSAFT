import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SERVICE_TOKEN_CONFIG } from './service-token.constants';
import type { ServiceTokenConfig } from './service-token.config';

// Header propio (no `Authorization`) para no confundir este secreto compartido
// servicio-a-servicio con un token OIDC de operador — CORE nunca ve ni valida tokens de Zitadel,
// esa es responsabilidad exclusiva de CIS (ver ADR-002).
export const SERVICE_TOKEN_HEADER = 'x-internal-service-token';

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(
    @Inject(SERVICE_TOKEN_CONFIG) private readonly config: ServiceTokenConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers[SERVICE_TOKEN_HEADER];
    const received = Array.isArray(header) ? header[0] : header;

    if (!received || !this.matches(received)) {
      throw new UnauthorizedException(
        `Falta o es inválido el header ${SERVICE_TOKEN_HEADER}`,
      );
    }

    return true;
  }

  // Comparacion en tiempo constante — evita que un atacante infiera el token comparando
  // latencias de respuesta caracter por caracter (timing attack sobre `===`/string compare).
  private matches(received: string): boolean {
    const expected = Buffer.from(this.config.token);
    const actual = Buffer.from(received);
    if (expected.length !== actual.length) {
      return false;
    }
    return timingSafeEqual(expected, actual);
  }
}
