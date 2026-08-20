import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPendingPkce,
  clearTokens,
  decodeJwtClaims,
  loadPendingPkce,
  loadTokens,
  savePendingPkce,
  saveTokens,
  type StoredTokens,
} from './token-store';

beforeEach(() => {
  sessionStorage.clear();
});

const TOKENS: StoredTokens = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  expiresAt: '2026-01-01T00:00:00.000Z',
};

describe('saveTokens / loadTokens / clearTokens', () => {
  it('persiste y recupera los tokens tal cual se guardaron', () => {
    saveTokens(TOKENS);
    expect(loadTokens()).toEqual(TOKENS);
  });

  it('devuelve null cuando no hay tokens guardados', () => {
    expect(loadTokens()).toBeNull();
  });

  it('devuelve null cuando el valor guardado no es JSON válido (storage corrupto)', () => {
    sessionStorage.setItem('web-sicsaft-oidc-tokens', 'no-es-json');
    expect(loadTokens()).toBeNull();
  });

  it('clearTokens borra los tokens guardados', () => {
    saveTokens(TOKENS);
    clearTokens();
    expect(loadTokens()).toBeNull();
  });
});

describe('savePendingPkce / loadPendingPkce / clearPendingPkce', () => {
  const PENDING = { codeVerifier: 'verifier-1', state: 'state-1' };

  it('persiste y recupera el PKCE pendiente tal cual se guardó', () => {
    savePendingPkce(PENDING);
    expect(loadPendingPkce()).toEqual(PENDING);
  });

  it('devuelve null cuando no hay PKCE pendiente', () => {
    expect(loadPendingPkce()).toBeNull();
  });

  it('devuelve null cuando el valor guardado no es JSON válido', () => {
    sessionStorage.setItem('web-sicsaft-oidc-pkce', '{invalido');
    expect(loadPendingPkce()).toBeNull();
  });

  it('clearPendingPkce borra el PKCE pendiente', () => {
    savePendingPkce(PENDING);
    clearPendingPkce();
    expect(loadPendingPkce()).toBeNull();
  });
});

// JWT sin firmar (alg: none) — mismo formato que usa ccp/tests/helpers.js para e2e, decodeJwtClaims
// nunca verifica firma (esa es responsabilidad de CIS, ver comentario en token-store.ts).
function base64url(json: string): string {
  // btoa solo acepta Latin1 — encodeURIComponent+unescape es el mismo truco UTF-8-safe que usa
  // decodeJwtClaims (en sentido inverso), necesario para construir un JWT de prueba con claims
  // no-ASCII (nombres con tildes/ñ).
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function buildUnsignedJwt(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.`;
}

describe('decodeJwtClaims', () => {
  it('decodifica el payload de un JWT válido de 3 partes', () => {
    const jwt = buildUnsignedJwt({ name: 'Ana Torres', sub: 'op-1' });
    expect(decodeJwtClaims(jwt)).toEqual({ name: 'Ana Torres', sub: 'op-1' });
  });

  it('devuelve null cuando el token no tiene 3 partes separadas por punto', () => {
    expect(decodeJwtClaims('solo-una-parte')).toBeNull();
    expect(decodeJwtClaims('dos.partes')).toBeNull();
  });

  it('devuelve null cuando el payload no es base64 válido', () => {
    expect(decodeJwtClaims('header.***no-es-base64***.firma')).toBeNull();
  });

  it('devuelve null cuando el payload decodificado no es JSON válido', () => {
    const header = btoa(JSON.stringify({ alg: 'none' }));
    const body = btoa('esto no es json');
    expect(decodeJwtClaims(`${header}.${body}.firma`)).toBeNull();
  });

  it('decodifica claims con caracteres no-ASCII (nombres con tildes/ñ)', () => {
    const jwt = buildUnsignedJwt({ name: 'Ñandú Muñoz' });
    expect(decodeJwtClaims(jwt)).toEqual({ name: 'Ñandú Muñoz' });
  });
});
