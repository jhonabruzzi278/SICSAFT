import { loadZitadelAuthConfig } from './zitadel-auth.config';

describe('loadZitadelAuthConfig', () => {
  const baseEnv = {
    ZITADEL_ISSUER: 'http://id.sicsaft.localhost',
    ZITADEL_AUDIENCE: 'cis-api',
  };

  it('deriva jwksUri de issuer cuando ZITADEL_JWKS_URI no esta seteado', () => {
    const config = loadZitadelAuthConfig(baseEnv);
    expect(config).toEqual({
      issuer: 'http://id.sicsaft.localhost',
      audience: 'cis-api',
      jwksUri: 'http://id.sicsaft.localhost/oauth/v2/keys',
    });
  });

  it('usa ZITADEL_JWKS_URI cuando esta seteado (ej. red interna de Docker)', () => {
    const config = loadZitadelAuthConfig({
      ...baseEnv,
      ZITADEL_JWKS_URI: 'http://zitadel:8080/oauth/v2/keys',
    });
    expect(config.jwksUri).toBe('http://zitadel:8080/oauth/v2/keys');
  });

  it('lanza si falta ZITADEL_ISSUER', () => {
    expect(() =>
      loadZitadelAuthConfig({ ZITADEL_AUDIENCE: 'cis-api' }),
    ).toThrow('ZITADEL_ISSUER');
  });

  it('lanza si falta ZITADEL_AUDIENCE', () => {
    expect(() =>
      loadZitadelAuthConfig({ ZITADEL_ISSUER: 'http://id.sicsaft.localhost' }),
    ).toThrow('ZITADEL_AUDIENCE');
  });
});
