import { InMemoryRateLimiter } from './in-memory-rate-limiter';

describe('InMemoryRateLimiter', () => {
  const options = { maxRequests: 3, windowMs: 10_000 };

  it('permite la request cuando el conteo no supera maxRequests', () => {
    const limiter = new InMemoryRateLimiter(options);

    const result = limiter.consume('op-1');

    expect(result).toEqual({ allowed: true, retryAfterMs: 0 });
  });

  it('permite la request cuando el conteo es exactamente maxRequests (límite inclusivo)', () => {
    const limiter = new InMemoryRateLimiter(options);

    limiter.consume('op-1');
    limiter.consume('op-1');
    const result = limiter.consume('op-1');

    expect(result.allowed).toBe(true);
  });

  it('rechaza la request cuando el conteo supera maxRequests y devuelve el TTL restante', () => {
    jest.useFakeTimers().setSystemTime(0);
    const limiter = new InMemoryRateLimiter(options);

    limiter.consume('op-1');
    limiter.consume('op-1');
    limiter.consume('op-1');
    jest.advanceTimersByTime(2_500);
    const result = limiter.consume('op-1');

    expect(result).toEqual({ allowed: false, retryAfterMs: 7_500 });
    jest.useRealTimers();
  });

  it('nunca devuelve un retryAfterMs negativo aunque la ventana ya haya vencido en el instante del rechazo', () => {
    jest.useFakeTimers().setSystemTime(0);
    const limiter = new InMemoryRateLimiter(options);

    limiter.consume('op-1');
    limiter.consume('op-1');
    limiter.consume('op-1');
    jest.advanceTimersByTime(10_000);
    const result = limiter.consume('op-1');

    // A los 10_000ms la ventana ya venció -> esta consume() abre una ventana nueva, no rechaza.
    expect(result).toEqual({ allowed: true, retryAfterMs: 0 });
    jest.useRealTimers();
  });

  it('resetea la ventana una vez que expira, en vez de seguir acumulando', () => {
    jest.useFakeTimers().setSystemTime(0);
    const limiter = new InMemoryRateLimiter(options);

    limiter.consume('op-1');
    limiter.consume('op-1');
    limiter.consume('op-1');
    jest.advanceTimersByTime(10_001);

    expect(limiter.consume('op-1')).toEqual({
      allowed: true,
      retryAfterMs: 0,
    });
    expect(limiter.consume('op-1').allowed).toBe(true);
    jest.useRealTimers();
  });

  it('lleva ventanas independientes por clave', () => {
    const limiter = new InMemoryRateLimiter(options);

    limiter.consume('op-1');
    limiter.consume('op-1');
    limiter.consume('op-1');
    const rechazoOp1 = limiter.consume('op-1');
    const permiteOp2 = limiter.consume('op-2');

    expect(rechazoOp1.allowed).toBe(false);
    expect(permiteOp2.allowed).toBe(true);
  });
});
