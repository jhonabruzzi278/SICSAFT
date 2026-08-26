// Cliente OIDC — authorization code + PKCE contra Keycloak (ADR-004, reemplaza a ADR-002), mismo mecanismo probado
// real de punta a punta en app-qr-sicsaft/src/lib/oidc/oidc-client.ts (TASK-007). WEB reusa el
// mismo proyecto "CIS" en Keycloak con una Aplicacion OIDC propia (`web-sicsaft`, User Agent,
// PKCE) — ver devops/local/README.md "Cliente OIDC real (WEB)".
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from './pkce';
import { loadOidcConfig } from './oidc-config';
import {
  clearPendingPkce,
  clearTokens,
  decodeJwtClaims,
  loadPendingPkce,
  loadTokens,
  saveTokens,
  savePendingPkce,
  type StoredTokens,
} from './token-store';

export class AuthenticationRequiredError extends Error {
  constructor() {
    super('Se requiere iniciar sesión');
    this.name = 'AuthenticationRequiredError';
  }
}

// offline_access: refresh token explicito, mismo criterio que app-qr-sicsaft (requiere el scope
// habilitado en la app OIDC de Keycloak).
const OIDC_SCOPE = 'openid profile offline_access';
const TOKEN_EXPIRY_SAFETY_MARGIN_MS = 30_000;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

function tokensFromResponse(
  response: TokenResponse,
  fallbackRefreshToken?: string,
): StoredTokens {
  const refreshToken = response.refresh_token ?? fallbackRefreshToken;
  if (!refreshToken) {
    throw new Error(
      'Keycloak no devolvió refresh_token — falta el scope offline_access o no está habilitado en la app OIDC.',
    );
  }
  return {
    accessToken: response.access_token,
    refreshToken,
    expiresAt: new Date(Date.now() + response.expires_in * 1000).toISOString(),
  };
}

async function postTokenEndpoint(
  body: URLSearchParams,
): Promise<TokenResponse> {
  const config = loadOidcConfig();
  const res = await fetch(
    new URL('/protocol/openid-connect/token', config.issuer),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(
      `Keycloak devolvió ${res.status} en /protocol/openid-connect/token`,
    );
  }
  return (await res.json()) as TokenResponse;
}

async function startLogin(): Promise<void> {
  const config = loadOidcConfig();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  savePendingPkce({ codeVerifier, state });

  const url = new URL('/protocol/openid-connect/auth', config.issuer);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', OIDC_SCOPE);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);

  window.location.assign(url.toString());
}

async function handleCallback(searchParams: URLSearchParams): Promise<void> {
  const oauthError = searchParams.get('error');
  const pending = loadPendingPkce();
  clearPendingPkce();

  if (oauthError) {
    throw new Error(`Keycloak rechazó el login: ${oauthError}`);
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state || !pending || state !== pending.state) {
    throw new Error(
      'Respuesta de login inválida o expirada — iniciá sesión de nuevo.',
    );
  }

  const config = loadOidcConfig();
  const tokens = tokensFromResponse(
    await postTokenEndpoint(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        code_verifier: pending.codeVerifier,
      }),
    ),
  );
  saveTokens(tokens);
}

async function refreshAccessToken(refreshToken: string): Promise<StoredTokens> {
  const config = loadOidcConfig();
  const tokens = tokensFromResponse(
    await postTokenEndpoint(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
      }),
    ),
    refreshToken,
  );
  saveTokens(tokens);
  return tokens;
}

function isExpired(tokens: StoredTokens): boolean {
  return (
    new Date(tokens.expiresAt).getTime() - TOKEN_EXPIRY_SAFETY_MARGIN_MS <=
    Date.now()
  );
}

async function getValidAccessToken(): Promise<string> {
  const tokens = loadTokens();
  if (!tokens) throw new AuthenticationRequiredError();
  if (!isExpired(tokens)) return tokens.accessToken;

  try {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    return refreshed.accessToken;
  } catch {
    clearTokens();
    throw new AuthenticationRequiredError();
  }
}

function getCurrentOperatorDisplayName(): string | null {
  const tokens = loadTokens();
  if (!tokens) return null;
  const claims = decodeJwtClaims(tokens.accessToken);
  const name = claims?.name ?? claims?.preferred_username ?? claims?.sub;
  return typeof name === 'string' ? name : null;
}

function isAuthenticated(): boolean {
  return loadTokens() !== null;
}

function logout(): void {
  clearTokens();
  clearPendingPkce();
}

export const oidcClient = {
  startLogin,
  handleCallback,
  getValidAccessToken,
  getCurrentOperatorDisplayName,
  isAuthenticated,
  logout,
};
