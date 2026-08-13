/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks no usan `this`, la regla
   solo tiene falsos positivos al referenciar un metodo mockeado sin invocarlo dentro de expect(). */
import type { Redis } from 'ioredis';
import { RateLimitModule } from './rate-limit.module';

describe('RateLimitModule', () => {
  it('desconecta el cliente Redis al destruirse el modulo', () => {
    const redis = { disconnect: jest.fn() } as unknown as Redis;
    const module = new RateLimitModule(redis);

    module.onModuleDestroy();

    expect(redis.disconnect).toHaveBeenCalledTimes(1);
  });
});
