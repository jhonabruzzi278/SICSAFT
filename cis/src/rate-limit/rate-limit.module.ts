import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { createRedisClient } from './create-redis-client';
import { loadRedisConfig } from './rate-limit.config';
import { RATE_LIMIT_OPTIONS, REDIS_CLIENT } from './rate-limit.constants';
import { RateLimitGuard } from './rate-limit.guard';
import type { RateLimitOptions } from './rate-limit.types';

// Parametros conservadores para el trafico actual, mismo criterio que CORE_CIRCUIT_BREAKER en
// core-client.module.ts: 30 requests por operador cada 10s (WAF §4).
const RATE_LIMIT_OPTIONS_VALUE: RateLimitOptions = {
  maxRequests: 30,
  windowMs: 10_000,
};

// Global: el guard se usa en cualquier controller detras de ZitadelAuthGuard (hoy solo
// QrConnectorController), mismo patron que ZitadelAuthModule.
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => createRedisClient(loadRedisConfig().url),
    },
    {
      provide: RATE_LIMIT_OPTIONS,
      useValue: RATE_LIMIT_OPTIONS_VALUE,
    },
    RateLimitGuard,
  ],
  exports: [REDIS_CLIENT, RATE_LIMIT_OPTIONS, RateLimitGuard],
})
export class RateLimitModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
