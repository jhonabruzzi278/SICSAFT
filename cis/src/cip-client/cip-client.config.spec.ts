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

  it('permite valores vacios por defecto para Nivel 1 sin CIP (CIP-05)', () => {
    const config = loadCipClientConfig({});
    expect(config).toEqual({
      baseUrl: '',
      serviceToken: '',
    });
  });
});
