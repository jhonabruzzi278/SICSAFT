import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  requireAuthContext,
  type AuthenticatedRequest,
} from '../common/auth/keycloak-auth.guard';
import { InMemoryRateLimiter } from './in-memory-rate-limiter';
import { RATE_LIMIT_OPTIONS } from './rate-limit.constants';
import type { RateLimitOptions } from './rate-limit.types';

const RATE_LIMIT_KEY_PREFIX = 'rate-limit:operador:';

// WAF 4 "rate limiting hacia el CORE", por operador — requiere que KeycloakAuthGuard ya haya
// corrido y seteado `request.auth` (orden en @UseGuards: KeycloakAuthGuard, RateLimitGuard). Por
// dispositivo sigue sin cubrir aca: `deviceId` solo llega en el body de auth/session, no en las
// otras 3 rutas (ver src/device-registry/ para el enforcement de "un solo dispositivo").
//
// ADR-005 — `InMemoryRateLimiter` se instancia una sola vez acá (el guard es un provider
// singleton, mismo criterio que ya usaba `new RedisRateLimiter(...)` en el constructor) — el
// estado vive en el propio proceso, no en un backend externo.
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter: InMemoryRateLimiter;

  constructor(@Inject(RATE_LIMIT_OPTIONS) options: RateLimitOptions) {
    this.limiter = new InMemoryRateLimiter(options);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = requireAuthContext(request);

    const result = this.limiter.consume(
      `${RATE_LIMIT_KEY_PREFIX}${auth.operadorId}`,
    );
    if (!result.allowed) {
      throw new HttpException(
        {
          message: 'Demasiadas solicitudes, intente de nuevo más tarde',
          retryAfterMs: result.retryAfterMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
