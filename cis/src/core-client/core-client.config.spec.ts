import { loadCoreClientConfig } from './core-client.config';

describe('loadCoreClientConfig', () => {
  it('lee CORE_URL del env', () => {
    const config = loadCoreClientConfig({ CORE_URL: 'http://core:3001' });
    expect(config).toEqual({ baseUrl: 'http://core:3001' });
  });

  it('lanza si falta CORE_URL', () => {
    expect(() => loadCoreClientConfig({})).toThrow('CORE_URL');
  });
});
