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
      // Sin METRICS_TOKEN, GET /metrics queda sin autenticar -- el default esperado en
      // devops/local/ (CIS ahi no tiene exposicion real que proteger). Advertencia, no error,
      // para no romper el arranque local -- pero si aparece en logs de devops/prod/ es una
      // brecha real, ver devops/prod/README.md "Hallazgo real".
      if (!MetricsTokenGuard.warnedMissingToken) {
        MetricsTokenGuard.logger.warn(
          'METRICS_TOKEN no configurado -- GET /metrics queda sin autenticar (default ' +
            'esperado en devops/local/; revisar devops/prod/.env si aparece este warning ahi).',
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
