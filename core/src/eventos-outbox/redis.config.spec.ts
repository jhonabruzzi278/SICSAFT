import { loadRedisConfig } from './redis.config';

describe('loadRedisConfig', () => {
  it('lee REDIS_URL del entorno', () => {
    const config = loadRedisConfig({
      REDIS_URL: 'redis://:secreto@redis:6379',
    });

    expect(config).toEqual({ url: 'redis://:secreto@redis:6379' });
  });

  it('tira un error legible si falta REDIS_URL', () => {
    expect(() => loadRedisConfig({})).toThrow(
      /Configuración de Redis inválida/,
    );
  });
});
