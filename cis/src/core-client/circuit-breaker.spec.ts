import { CircuitBreaker, CircuitOpenError } from './circuit-breaker';

function buildBreaker(): CircuitBreaker {
  return new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
}

describe('CircuitBreaker', () => {
  it('empieza cerrado y deja pasar llamadas exitosas', async () => {
    const breaker = buildBreaker();

    await expect(breaker.execute(() => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
    expect(breaker.getState()).toBe('closed');
  });

  it('se abre tras alcanzar el umbral de fallos consecutivos', async () => {
    const breaker = buildBreaker();
    const fallo = (): Promise<never> => Promise.reject(new Error('boom'));

    await expect(breaker.execute(fallo)).rejects.toThrow('boom');
    await expect(breaker.execute(fallo)).rejects.toThrow('boom');
    expect(breaker.getState()).toBe('closed');
    await expect(breaker.execute(fallo)).rejects.toThrow('boom');
    expect(breaker.getState()).toBe('open');
  });

  it('abierto: rechaza sin ejecutar la funcion hasta que pase resetTimeoutMs', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 50,
    });
    const fn = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(breaker.execute(fn)).rejects.toThrow('boom');
    expect(breaker.getState()).toBe('open');

    await expect(breaker.execute(fn)).rejects.toThrow(CircuitOpenError);
    expect(fn).toHaveBeenCalledTimes(1); // el segundo intento no llamo a fn
  });

  it('half-open: un exito cierra el circuito de nuevo', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 10,
    });

    await expect(
      breaker.execute(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    expect(breaker.getState()).toBe('open');

    await new Promise((resolve) => setTimeout(resolve, 15));

    await expect(breaker.execute(() => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
    expect(breaker.getState()).toBe('closed');
  });

  it('half-open: un fallo vuelve a abrir el circuito de inmediato', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      resetTimeoutMs: 10,
    });

    await expect(
      breaker.execute(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    await new Promise((resolve) => setTimeout(resolve, 15));

    await expect(
      breaker.execute(() => Promise.reject(new Error('boom-2'))),
    ).rejects.toThrow('boom-2');
    expect(breaker.getState()).toBe('open');
  });
});
