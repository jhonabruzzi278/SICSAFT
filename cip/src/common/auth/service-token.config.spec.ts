import { loadServiceTokenConfig } from './service-token.config';

describe('loadServiceTokenConfig', () => {
  it('lee CIP_SERVICE_TOKEN del env', () => {
    const config = loadServiceTokenConfig({
      CIP_SERVICE_TOKEN: 'secreto-compartido',
    });
    expect(config).toEqual({ token: 'secreto-compartido' });
  });

  it('lanza si falta CIP_SERVICE_TOKEN', () => {
    expect(() => loadServiceTokenConfig({})).toThrow('CIP_SERVICE_TOKEN');
  });
});
