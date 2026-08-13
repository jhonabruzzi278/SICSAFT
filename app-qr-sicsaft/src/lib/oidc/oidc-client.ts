// Cliente OIDC — authorization code + PKCE contra Zitadel (ADR-002), ya probado real de punta a
// punta con curl simulando el navegador (ver devops/local/README.md "Cliente OIDC real"). Este
// módulo es la implementación real de ese mismo flujo desde la UI (TASK-007).
import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce';
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

// Refresh token explícito (no re-login silencioso) — decisión confirmada: requiere que la app
// OIDC de app-qr-sicsaft en Zitadel tenga el scope `offline_access` habilitado (Token Settings),
// ver devops/local/README.md. Sin eso, `tokensFromResponse` falla fuerte en vez de degradar a un
// re-login silencioso no pedido.
const OIDC_SCOPE = 'openid profile offline_access';
// Margen de seguridad antes del vencimiento real — evita mandar un request con un token que
// expira en el viaje de red.
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
      'Zitadel no devolvió refresh_token — falta el scope offline_access o no está habilitado en la app OIDC (ver devops/local/README.md "Cliente OIDC real").',
    );
  }
  return {
    accessToken: response.access_token,
    refreshToken,
    expiresAt: new Date(Date.now() + response.expires_in * 1000).toISOString(),
  };
}

async function postTokenEndpoint(body: URLSearchParams): Promise<TokenResponse> {
  const config = loadOidcConfig();
  const res = await fetch(new URL('/oauth/v2/token', config.issuer), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`Zitadel devolvió ${res.status} en /oauth/v2/token`);
  }
  return (await res.json()) as TokenResponse;
}

// Redirige a Zitadel — se llama desde un gesto explícito del operador (botón), no automático,
// para no sorprender a alguien reabriendo la PWA con un redirect inesperado.
async function startLogin(): Promise<void> {
  const config = loadOidcConfig();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  savePendingPkce({ codeVerifier, state });

  const url = new URL('/oauth/v2/authorize', config.issuer);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', OIDC_SCOPE);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);

  window.location.assign(url.toString());
}

// Se llama desde AuthCallbackPage al volver del redirect — valida `state` contra lo guardado
// antes de redirigir (CSRF del flujo de authorization code) y canjea el `code` por tokens.
async function handleCallback(searchParams: URLSearchParams): Promise<void> {
  const oauthError = searchParams.get('error');
  const pending = loadPendingPkce();
  clearPendingPkce();

  if (oauthError) {
    throw new Error(`Zitadel rechazó el login: ${oauthError}`);
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state || !pending || state !== pending.state) {
    throw new Error('Respuesta de login inválida o expirada — iniciá sesión de nuevo.');
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
  return new Date(tokens.expiresAt).getTime() - TOKEN_EXPIRY_SAFETY_MARGIN_MS <= Date.now();
}

// Devuelve un access token vigente, renovando con el refresh token si hace falta.
// AuthenticationRequiredError es la señal que qr-connector.ts usa para mandar al operador a
// loguearse de nuevo en vez de tratarlo como una falla transitoria de red.
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

// Solo para mostrar quién es el operador en la UI (`ScanPage`, `audit-log.ts`) — el claim no se
// verifica acá, CIS ya validó firma/vencimiento server-side en cada request real.
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
