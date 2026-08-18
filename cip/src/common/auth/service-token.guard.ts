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

// Header propio (no `Authorization`) — mismo mecanismo que core/src/common/auth/service-token.guard.ts.
export const SERVICE_TOKEN_HEADER = 'x-internal-service-token';

export interface ServiceAuthenticatedRequest extends Request {
  serviceAuthenticated?: boolean;
}

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(
    @Inject(SERVICE_TOKEN_CONFIG) private readonly config: ServiceTokenConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<ServiceAuthenticatedRequest>();
    const header = request.headers[SERVICE_TOKEN_HEADER];
    const received = Array.isArray(header) ? header[0] : header;

    if (!received || !this.matches(received)) {
      throw new UnauthorizedException(
        `Falta o es inválido el header ${SERVICE_TOKEN_HEADER}`,
      );
    }

    request.serviceAuthenticated = true;
    return true;
  }

  // Comparacion en tiempo constante — evita un timing attack sobre `===`.
  private matches(received: string): boolean {
    const expected = Buffer.from(this.config.token);
    const actual = Buffer.from(received);
    if (expected.length !== actual.length) {
      return false;
    }
    return timingSafeEqual(expected, actual);
  }
}
