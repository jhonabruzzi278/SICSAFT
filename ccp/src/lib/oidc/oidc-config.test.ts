import { afterEach, describe, expect, it } from 'vitest';
import { loadOidcConfig } from './oidc-config';

const REQUIRED_VARS = [
  'VITE_KEYCLOAK_ISSUER',
  'VITE_KEYCLOAK_CLIENT_ID',
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

declare global {
  interface Window {
    __SICSAFT_PORTAL_CONFIG__?: Record<string, string>;
  }
}

describe('loadOidcConfig', () => {
  afterEach(() => {
    for (const key of REQUIRED_VARS) delete import.meta.env[key];
    delete window.__SICSAFT_PORTAL_CONFIG__;
  });

  it('arma la config completa cuando las 3 env vars requeridas están presentes', () => {
    setEnv({
      VITE_KEYCLOAK_ISSUER: 'http://id.sicsaft.localhost',
      VITE_KEYCLOAK_CLIENT_ID: 'client-1',
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
        VITE_KEYCLOAK_ISSUER: 'http://id.sicsaft.localhost',
        VITE_KEYCLOAK_CLIENT_ID: 'client-1',
        VITE_CIS_URL: 'http://api.sicsaft.localhost',
        [missing]: undefined,
      });

      expect(() => loadOidcConfig()).toThrow(missing);
    },
  );

  it('trata un string vacío como "no configurada", no como valor válido', () => {
    setEnv({
      VITE_KEYCLOAK_ISSUER: '',
      VITE_KEYCLOAK_CLIENT_ID: 'client-1',
      VITE_CIS_URL: 'http://api.sicsaft.localhost',
    });

    expect(() => loadOidcConfig()).toThrow('VITE_KEYCLOAK_ISSUER');
  });

  // DOC-028 Fase C.0 — servido por el .exe embebido de sicsaft-core, la config viene de
  // window.__SICSAFT_PORTAL_CONFIG__ (inyectada en el index.html), no del build.
  it('usa window.__SICSAFT_PORTAL_CONFIG__ cuando está presente, sin necesidad de env vars', () => {
    window.__SICSAFT_PORTAL_CONFIG__ = {
      VITE_KEYCLOAK_ISSUER: 'http://192.168.1.11:58080/realms/sicsaft',
      VITE_KEYCLOAK_CLIENT_ID: 'ccp',
      VITE_CIS_URL: 'http://127.0.0.1:56000',
    };

    const config = loadOidcConfig();

    expect(config.issuer).toBe('http://192.168.1.11:58080/realms/sicsaft');
    expect(config.clientId).toBe('ccp');
    expect(config.cisUrl).toBe('http://127.0.0.1:56000');
  });

  it('la config runtime tiene prioridad sobre import.meta.env (una IP nueva reemplaza a la horneada)', () => {
    setEnv({
      VITE_KEYCLOAK_ISSUER: 'http://192.168.1.11:58080/realms/sicsaft',
      VITE_KEYCLOAK_CLIENT_ID: 'ccp',
      VITE_CIS_URL: 'http://127.0.0.1:56000',
    });
    window.__SICSAFT_PORTAL_CONFIG__ = {
      VITE_KEYCLOAK_ISSUER: 'http://192.168.1.8:58080/realms/sicsaft',
    };

    const config = loadOidcConfig();

    expect(config.issuer).toBe('http://192.168.1.8:58080/realms/sicsaft');
    // las claves que la config runtime no trae siguen viniendo de env
    expect(config.clientId).toBe('ccp');
  });

  it('un valor vacío en la config runtime cae a import.meta.env, no rompe', () => {
    setEnv({
      VITE_KEYCLOAK_ISSUER: 'http://id.sicsaft.localhost',
      VITE_KEYCLOAK_CLIENT_ID: 'client-1',
      VITE_CIS_URL: 'http://api.sicsaft.localhost',
    });
    window.__SICSAFT_PORTAL_CONFIG__ = { VITE_KEYCLOAK_ISSUER: '' };

    expect(loadOidcConfig().issuer).toBe('http://id.sicsaft.localhost');
  });
});
