import { loadServiceTokenConfig } from './service-token.config';

describe('loadServiceTokenConfig', () => {
  it('lee CORE_SERVICE_TOKEN del env', () => {
    const config = loadServiceTokenConfig({
      CORE_SERVICE_TOKEN: 'secreto-compartido',
    });
    expect(config).toEqual({ token: 'secreto-compartido' });
  });

  it('lanza si falta CORE_SERVICE_TOKEN', () => {
    expect(() => loadServiceTokenConfig({})).toThrow('CORE_SERVICE_TOKEN');
  });
});
