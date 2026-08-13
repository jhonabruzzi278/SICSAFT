import type { Redis } from 'ioredis';
import { RedisRateLimiter } from './redis-rate-limiter';

function buildRedisMock(): jest.Mocked<Pick<Redis, 'eval' | 'pttl'>> {
  return {
    eval: jest.fn(),
    pttl: jest.fn(),
  };
}

describe('RedisRateLimiter', () => {
  const options = { maxRequests: 3, windowMs: 10_000 };

  it('permite la request cuando el conteo no supera maxRequests', async () => {
    const redis = buildRedisMock();
    redis.eval.mockResolvedValue(1);
    const limiter = new RedisRateLimiter(redis as unknown as Redis, options);

    const result = await limiter.consume('op-1');

    expect(result).toEqual({ allowed: true, retryAfterMs: 0 });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'op-1',
      options.windowMs,
    );
  });

  it('permite la request cuando el conteo es exactamente maxRequests (limite inclusivo)', async () => {
    const redis = buildRedisMock();
    redis.eval.mockResolvedValue(3);
    const limiter = new RedisRateLimiter(redis as unknown as Redis, options);

    const result = await limiter.consume('op-1');

    expect(result.allowed).toBe(true);
  });

  it('rechaza la request cuando el conteo supera maxRequests y devuelve el TTL restante', async () => {
    const redis = buildRedisMock();
    redis.eval.mockResolvedValue(4);
    redis.pttl.mockResolvedValue(7_500);
    const limiter = new RedisRateLimiter(redis as unknown as Redis, options);

    const result = await limiter.consume('op-1');

    expect(result).toEqual({ allowed: false, retryAfterMs: 7_500 });
  });

  it('nunca devuelve un retryAfterMs negativo aunque pttl devuelva -1/-2 (clave sin TTL o inexistente)', async () => {
    const redis = buildRedisMock();
    redis.eval.mockResolvedValue(4);
    redis.pttl.mockResolvedValue(-2);
    const limiter = new RedisRateLimiter(redis as unknown as Redis, options);

    const result = await limiter.consume('op-1');

    expect(result).toEqual({ allowed: false, retryAfterMs: 0 });
  });

  it('falla abierto (permite la request) si Redis rechaza el comando de incremento', async () => {
    const redis = buildRedisMock();
    redis.eval.mockRejectedValue(new Error('ECONNREFUSED'));
    const limiter = new RedisRateLimiter(redis as unknown as Redis, options);

    const result = await limiter.consume('op-1');

    expect(result).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it('falla abierto (retryAfterMs 0) si Redis rechaza el PTTL tras detectar el exceso', async () => {
    const redis = buildRedisMock();
    redis.eval.mockResolvedValue(4);
    redis.pttl.mockRejectedValue(new Error('ECONNREFUSED'));
    const limiter = new RedisRateLimiter(redis as unknown as Redis, options);

    const result = await limiter.consume('op-1');

    expect(result).toEqual({ allowed: false, retryAfterMs: 0 });
  });
});
