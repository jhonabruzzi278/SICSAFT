import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { RATE_LIMIT_OPTIONS } from './rate-limit.constants';
import { RateLimitGuard } from './rate-limit.guard';
import type { RateLimitOptions } from './rate-limit.types';

// Parametros conservadores para el trafico actual, mismo criterio que CORE_CIRCUIT_BREAKER en
// core-client.module.ts: 30 requests por operador cada 10s (WAF 4).
const RATE_LIMIT_OPTIONS_VALUE: RateLimitOptions = {
  maxRequests: 30,
  windowMs: 10_000,
};

// Global: el guard se usa en cualquier controller detras de ZitadelAuthGuard (hoy solo
// QrConnectorController), mismo patron que ZitadelAuthModule.
@Global()
@Module({
  imports: [RedisModule],
  providers: [
    {
      provide: RATE_LIMIT_OPTIONS,
      useValue: RATE_LIMIT_OPTIONS_VALUE,
    },
    RateLimitGuard,
  ],
  exports: [RATE_LIMIT_OPTIONS, RateLimitGuard],
})
export class RateLimitModule {}
