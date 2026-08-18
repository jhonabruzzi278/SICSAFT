import { loadCipClientConfig } from './cip-client.config';

describe('loadCipClientConfig', () => {
  const baseEnv = {
    CIP_URL: 'http://cip:3002',
    CIP_SERVICE_TOKEN: 'secreto-compartido',
  };

  it('lee CIP_URL y CIP_SERVICE_TOKEN del env', () => {
    const config = loadCipClientConfig(baseEnv);
    expect(config).toEqual({
      baseUrl: 'http://cip:3002',
      serviceToken: 'secreto-compartido',
    });
  });

  it('lanza si falta CIP_URL', () => {
    expect(() =>
      loadCipClientConfig({ CIP_SERVICE_TOKEN: 'secreto-compartido' }),
    ).toThrow('CIP_URL');
  });

  it('lanza si falta CIP_SERVICE_TOKEN', () => {
    expect(() => loadCipClientConfig({ CIP_URL: 'http://cip:3002' })).toThrow(
      'CIP_SERVICE_TOKEN',
    );
  });
});
