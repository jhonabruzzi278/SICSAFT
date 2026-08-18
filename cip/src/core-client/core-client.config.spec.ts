import { loadCoreClientConfig } from './core-client.config';

describe('loadCoreClientConfig', () => {
  it('lee CORE_URL y CORE_SERVICE_TOKEN del env', () => {
    const config = loadCoreClientConfig({
      CORE_URL: 'http://core:3001',
      CORE_SERVICE_TOKEN: 'secreto-compartido',
    });

    expect(config).toEqual({
      baseUrl: 'http://core:3001',
      serviceToken: 'secreto-compartido',
    });
  });

  it('lanza si falta alguna variable requerida', () => {
    expect(() => loadCoreClientConfig({})).toThrow(
      'Configuración del cliente de CORE inválida',
    );
  });
});
