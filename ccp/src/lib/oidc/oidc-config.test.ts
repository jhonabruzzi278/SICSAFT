import { afterEach, describe, expect, it } from 'vitest';
import { loadOidcConfig } from './oidc-config';

const REQUIRED_VARS = [
  'VITE_ZITADEL_ISSUER',
  'VITE_ZITADEL_CLIENT_ID',
  'VITE_CIS_URL',
] as const;
type RequiredVar = (typeof REQUIRED_VARS)[number];

function setEnv(
  overrides: Partial<Record<RequiredVar, string | undefined>>,
): void {
  for (const key of REQUIRED_VARS) {
    const value = overrides[key];
    if (value === undefined) {
      delete import.meta.env[key];
    } else {
      import.meta.env[key] = value;
    }
  }
}

describe('loadOidcConfig', () => {
  afterEach(() => {
    for (const key of REQUIRED_VARS) delete import.meta.env[key];
  });

  it('arma la config completa cuando las 3 env vars requeridas están presentes', () => {
    setEnv({
      VITE_ZITADEL_ISSUER: 'http://id.sicsaft.localhost',
      VITE_ZITADEL_CLIENT_ID: 'client-1',
      VITE_CIS_URL: 'http://api.sicsaft.localhost',
    });

    const config = loadOidcConfig();

    expect(config.issuer).toBe('http://id.sicsaft.localhost');
    expect(config.clientId).toBe('client-1');
    expect(config.cisUrl).toBe('http://api.sicsaft.localhost');
    // redirectUri se deriva del origin real del navegador, no de una env var — DOC-023, la
    // causa raíz del "invalid_request: redirect_uri missing" que encontramos con el usuario.
    expect(config.redirectUri).toBe(`${window.location.origin}/auth/callback`);
  });

  it.each(REQUIRED_VARS)(
    'lanza un error mencionando la variable cuando falta %s',
    (missing) => {
      setEnv({
        VITE_ZITADEL_ISSUER: 'http://id.sicsaft.localhost',
        VITE_ZITADEL_CLIENT_ID: 'client-1',
        VITE_CIS_URL: 'http://api.sicsaft.localhost',
        [missing]: undefined,
      });

      expect(() => loadOidcConfig()).toThrow(missing);
    },
  );

  it('trata un string vacío como "no configurada", no como valor válido', () => {
    setEnv({
      VITE_ZITADEL_ISSUER: '',
      VITE_ZITADEL_CLIENT_ID: 'client-1',
      VITE_CIS_URL: 'http://api.sicsaft.localhost',
    });

    expect(() => loadOidcConfig()).toThrow('VITE_ZITADEL_ISSUER');
  });
});
