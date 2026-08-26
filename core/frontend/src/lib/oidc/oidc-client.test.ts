import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationRequiredError, oidcClient } from './oidc-client';
import {
  loadPendingPkce,
  loadTokens,
  savePendingPkce,
  saveTokens,
  type StoredTokens,
} from './token-store';

// DOC-023 (hallazgo de cobertura) — OIDC/PKCE es el código más sensible de los 3 portales
// (authorization code + PKCE contra Keycloak, protección CSRF vía state, refresh de sesión) y no
// tenía un solo test, ni unitario ni e2e (core/frontend/ no tenía ningún test de ningún tipo).

const ISSUER = 'http://id.sicsaft.localhost';
const CLIENT_ID = 'client-1';
const CIS_URL = 'http://api.sicsaft.localhost';
const ORIGIN = 'http://directivo.sicsaft.localhost';

const fetchMock = vi.fn();
const locationAssignMock = vi.fn();

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  } as Response;
}

function base64url(json: string): string {
  // btoa solo acepta Latin1 — encodeURIComponent+unescape es UTF-8-safe (mismo criterio que
  // token-store.test.ts).
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function tokensWithClaims(claims: Record<string, unknown>): StoredTokens {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = base64url(JSON.stringify(claims));
  return {
    accessToken: `${header}.${body}.`,
    refreshToken: 'refresh-1',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

beforeEach(() => {
  sessionStorage.clear();
  import.meta.env.VITE_KEYCLOAK_ISSUER = ISSUER;
  import.meta.env.VITE_KEYCLOAK_CLIENT_ID = CLIENT_ID;
  import.meta.env.VITE_CIS_URL = CIS_URL;
  fetchMock.mockReset();
  locationAssignMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('location', { origin: ORIGIN, assign: locationAssignMock });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('startLogin', () => {
  it('redirige al endpoint de autorización de Keycloak con los parámetros PKCE correctos', async () => {
    await oidcClient.startLogin();

    expect(locationAssignMock).toHaveBeenCalledTimes(1);
    const url = new URL(locationAssignMock.mock.calls[0][0] as string);

    expect(url.origin).toBe(ISSUER);
    expect(url.pathname).toBe('/protocol/openid-connect/auth');
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(
      `${ORIGIN}/auth/callback`,
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid profile offline_access');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('guarda code_verifier y state en sessionStorage antes de redirigir, para validarlos en el callback', async () => {
    await oidcClient.startLogin();

    const pending = loadPendingPkce();
    expect(pending?.codeVerifier).toBeTruthy();
    expect(pending?.state).toBeTruthy();
  });
});

describe('handleCallback', () => {
  it('lanza error cuando Keycloak devuelve un parámetro error', async () => {
    savePendingPkce({ codeVerifier: 'v', state: 's' });

    await expect(
      oidcClient.handleCallback(
        new URLSearchParams({ error: 'access_denied' }),
      ),
    ).rejects.toThrow('access_denied');
  });

  it('lanza error cuando falta el code', async () => {
    savePendingPkce({ codeVerifier: 'v', state: 's' });

    await expect(
      oidcClient.handleCallback(new URLSearchParams({ state: 's' })),
    ).rejects.toThrow();
  });

  it('lanza error cuando el state no coincide con el pendiente (protección CSRF)', async () => {
    savePendingPkce({ codeVerifier: 'v', state: 'state-real' });

    await expect(
      oidcClient.handleCallback(
        new URLSearchParams({ code: 'abc', state: 'state-falso' }),
      ),
    ).rejects.toThrow();
  });

  it('lanza error cuando no hay PKCE pendiente en sessionStorage', async () => {
    await expect(
      oidcClient.handleCallback(
        new URLSearchParams({ code: 'abc', state: 's' }),
      ),
    ).rejects.toThrow();
  });

  it('limpia el PKCE pendiente aunque la validación falle (no reutilizable con el mismo state)', async () => {
    savePendingPkce({ codeVerifier: 'v', state: 'state-real' });

    await expect(
      oidcClient.handleCallback(
        new URLSearchParams({ code: 'abc', state: 'state-falso' }),
      ),
    ).rejects.toThrow();
    expect(loadPendingPkce()).toBeNull();
  });

  it('intercambia el code por tokens y los guarda cuando todo es válido', async () => {
    savePendingPkce({ codeVerifier: 'verifier-real', state: 'state-real' });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
      }),
    );

    await oidcClient.handleCallback(
      new URLSearchParams({ code: 'auth-code', state: 'state-real' }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${ISSUER}/protocol/openid-connect/token`);
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('code_verifier')).toBe('verifier-real');
    expect(body.get('client_id')).toBe(CLIENT_ID);

    const stored = loadTokens();
    expect(stored?.accessToken).toBe('new-access');
    expect(stored?.refreshToken).toBe('new-refresh');
  });

  it('lanza error cuando la respuesta de Keycloak no es ok', async () => {
    savePendingPkce({ codeVerifier: 'v', state: 's' });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({}, { ok: false, status: 400 }),
    );

    await expect(
      oidcClient.handleCallback(new URLSearchParams({ code: 'c', state: 's' })),
    ).rejects.toThrow('400');
  });

  it('lanza error cuando Keycloak no devuelve refresh_token (falta el scope offline_access)', async () => {
    savePendingPkce({ codeVerifier: 'v', state: 's' });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'a', expires_in: 3600 }),
    );

    await expect(
      oidcClient.handleCallback(new URLSearchParams({ code: 'c', state: 's' })),
    ).rejects.toThrow('offline_access');
  });
});

describe('getValidAccessToken', () => {
  it('lanza AuthenticationRequiredError cuando no hay tokens guardados', async () => {
    await expect(oidcClient.getValidAccessToken()).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
  });

  it('devuelve el access token existente cuando todavía no expiró', async () => {
    saveTokens({
      accessToken: 'still-valid',
      refreshToken: 'refresh-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });

    await expect(oidcClient.getValidAccessToken()).resolves.toBe('still-valid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('considera expirado un token dentro del margen de seguridad de 30s y lo refresca', async () => {
    saveTokens({
      accessToken: 'about-to-expire',
      refreshToken: 'refresh-1',
      expiresAt: new Date(Date.now() + 10_000).toISOString(),
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        access_token: 'refreshed',
        refresh_token: 'refresh-2',
        expires_in: 3600,
      }),
    );

    await expect(oidcClient.getValidAccessToken()).resolves.toBe('refreshed');
    expect(loadTokens()?.accessToken).toBe('refreshed');
  });

  it('reusa el refresh token anterior cuando Keycloak no devuelve uno nuevo', async () => {
    saveTokens({
      accessToken: 'expired',
      refreshToken: 'refresh-original',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'refreshed', expires_in: 3600 }),
    );

    await oidcClient.getValidAccessToken();

    expect(loadTokens()?.refreshToken).toBe('refresh-original');
  });

  it('limpia los tokens y lanza AuthenticationRequiredError cuando el refresh falla', async () => {
    saveTokens({
      accessToken: 'expired',
      refreshToken: 'refresh-invalido',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({}, { ok: false, status: 401 }),
    );

    await expect(oidcClient.getValidAccessToken()).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
    expect(loadTokens()).toBeNull();
  });
});

describe('getCurrentOperatorDisplayName', () => {
  it('devuelve null cuando no hay sesión', () => {
    expect(oidcClient.getCurrentOperatorDisplayName()).toBeNull();
  });

  it('devuelve el claim "name" cuando está presente', () => {
    saveTokens(tokensWithClaims({ name: 'Ana Torres', sub: 'op-1' }));
    expect(oidcClient.getCurrentOperatorDisplayName()).toBe('Ana Torres');
  });

  it('cae a "preferred_username" cuando no hay "name"', () => {
    saveTokens(
      tokensWithClaims({ preferred_username: 'ana.torres', sub: 'op-1' }),
    );
    expect(oidcClient.getCurrentOperatorDisplayName()).toBe('ana.torres');
  });

  it('cae a "sub" cuando no hay "name" ni "preferred_username"', () => {
    saveTokens(tokensWithClaims({ sub: 'op-1' }));
    expect(oidcClient.getCurrentOperatorDisplayName()).toBe('op-1');
  });
});

describe('isAuthenticated', () => {
  it('es false sin tokens y true con tokens guardados', () => {
    expect(oidcClient.isAuthenticated()).toBe(false);
    saveTokens({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: new Date().toISOString(),
    });
    expect(oidcClient.isAuthenticated()).toBe(true);
  });
});

describe('logout', () => {
  it('limpia tokens y PKCE pendiente', () => {
    saveTokens({
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: new Date().toISOString(),
    });
    savePendingPkce({ codeVerifier: 'v', state: 's' });

    oidcClient.logout();

    expect(loadTokens()).toBeNull();
    expect(loadPendingPkce()).toBeNull();
  });
});
