import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  requireAuthContext,
  type AuthenticatedRequest,
} from '../common/auth/keycloak-auth.guard';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { RATE_LIMIT_OPTIONS } from './rate-limit.constants';
import { RedisRateLimiter } from './redis-rate-limiter';
import type { RateLimitOptions } from './rate-limit.types';

const RATE_LIMIT_KEY_PREFIX = 'rate-limit:operador:';

// WAF 4 "rate limiting hacia el CORE", por operador — requiere que KeycloakAuthGuard ya haya
// corrido y seteado `request.auth` (orden en @UseGuards: KeycloakAuthGuard, RateLimitGuard). Por
// dispositivo sigue sin cubrir aca: `deviceId` solo llega en el body de auth/session, no en las
// otras 3 rutas (ver src/device-registry/ para el enforcement de "un solo dispositivo").
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter: RedisRateLimiter;

  constructor(
    @Inject(REDIS_CLIENT) redis: Redis,
    @Inject(RATE_LIMIT_OPTIONS) options: RateLimitOptions,
  ) {
    this.limiter = new RedisRateLimiter(redis, options);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = requireAuthContext(request);

    const result = await this.limiter.consume(
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
