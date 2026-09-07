import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { METRICS_CONFIG } from './metrics.constants';
import type { MetricsConfig } from './metrics.config';

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class MetricsTokenGuard implements CanActivate {
  private static readonly logger = new Logger(MetricsTokenGuard.name);
  private static warnedMissingToken = false;

  constructor(@Inject(METRICS_CONFIG) private readonly config: MetricsConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const { token } = this.config;

    if (!token) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException(
          'METRICS_TOKEN es obligatorio en producción para acceder a /metrics',
        );
      }
      if (!MetricsTokenGuard.warnedMissingToken) {
        MetricsTokenGuard.logger.warn(
          'METRICS_TOKEN no configurado -- GET /metrics queda sin autenticar (permitido solo en dev/local; configurar METRICS_TOKEN en producción).',
        );
        MetricsTokenGuard.warnedMissingToken = true;
      }
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;

    if (
      !header?.startsWith(BEARER_PREFIX) ||
      !this.matches(token, header.slice(BEARER_PREFIX.length))
    ) {
      throw new UnauthorizedException(
        'Falta o es inválido el header Authorization',
      );
    }
    return true;
  }

  // Comparacion en tiempo constante -- mismo criterio que ServiceTokenGuard (CORE), evita que un
  // atacante infiera el token comparando latencias de respuesta caracter por caracter.
  private matches(expectedToken: string, received: string): boolean {
    const expected = Buffer.from(expectedToken);
    const actual = Buffer.from(received);
    if (expected.length !== actual.length) {
      return false;
    }
    return timingSafeEqual(expected, actual);
  }
}
