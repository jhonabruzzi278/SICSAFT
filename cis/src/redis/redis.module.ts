import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { createRedisClient } from './create-redis-client';
import { loadRedisConfig } from './redis.config';
import { REDIS_CLIENT } from './redis.constants';

// Global: un unico cliente Redis compartido por todos los consumidores (src/rate-limit/,
// src/device-registry/) — mismo patron que ZitadelAuthModule.
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => createRedisClient(loadRedisConfig().url),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
