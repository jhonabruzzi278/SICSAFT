import { loadCoreClientConfig } from './core-client.config';

describe('loadCoreClientConfig', () => {
  const baseEnv = {
    CORE_URL: 'http://core:3001',
    CORE_SERVICE_TOKEN: 'secreto-compartido',
  };

  it('lee CORE_URL y CORE_SERVICE_TOKEN del env', () => {
    const config = loadCoreClientConfig(baseEnv);
    expect(config).toEqual({
      baseUrl: 'http://core:3001',
      serviceToken: 'secreto-compartido',
    });
  });

  it('lanza si falta CORE_URL', () => {
    expect(() =>
      loadCoreClientConfig({ CORE_SERVICE_TOKEN: 'secreto-compartido' }),
    ).toThrow('CORE_URL');
  });

  it('lanza si falta CORE_SERVICE_TOKEN', () => {
    expect(() =>
      loadCoreClientConfig({ CORE_URL: 'http://core:3001' }),
    ).toThrow('CORE_SERVICE_TOKEN');
  });
});
