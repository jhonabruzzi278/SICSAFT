import { withRetry } from './retry';

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('devuelve el resultado en el primer intento si no falla', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 100,
        shouldRetry: () => true,
      }),
    ).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reintenta con backoff exponencial hasta que un intento tiene éxito', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fallo 1'))
      .mockRejectedValueOnce(new Error('fallo 2'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      shouldRetry: () => true,
    });

    await jest.advanceTimersByTimeAsync(100); // backoff del 1er reintento
    await jest.advanceTimersByTimeAsync(200); // backoff del 2do reintento (exponencial: x2)

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('lanza el último error al agotar maxAttempts, sin reintentar de más', async () => {
    const error = new Error('siempre falla');
    const fn = jest.fn().mockRejectedValue(error);

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      shouldRetry: () => true,
    });
    const assertion = expect(promise).rejects.toThrow(error);

    await jest.advanceTimersByTimeAsync(10);
    await jest.advanceTimersByTimeAsync(20);

    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('no reintenta si shouldRetry devuelve false (rechazo permanente, ej. 400/409)', async () => {
    const error = new Error('no reintentable');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 10,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('con maxAttempts=1 falla en el primer intento sin esperar ni reintentar', async () => {
    const error = new Error('unico intento');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(
      withRetry(fn, {
        maxAttempts: 1,
        baseDelayMs: 1000,
        shouldRetry: () => true,
      }),
    ).rejects.toThrow(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
