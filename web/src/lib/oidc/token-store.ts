// sessionStorage a proposito, no localStorage: el access token es un secreto y el Administrador
// Patrimonial re-autentica cada sesion de navegador en vez de dejar un token vivo indefinidamente
// (mismo criterio que app-qr-sicsaft/src/lib/oidc/token-store.ts — acá el blast radius de un
// token comprometido es mayor, WEB tiene permisos de escritura amplios, ver ARCHITECTURE.md
// "Decision abierta").
const TOKENS_KEY = 'web-sicsaft-oidc-tokens';
const PKCE_KEY = 'web-sicsaft-oidc-pkce';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export function saveTokens(tokens: StoredTokens): void {
  sessionStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function loadTokens(): StoredTokens | null {
  const raw = sessionStorage.getItem(TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export function clearTokens(): void {
  sessionStorage.removeItem(TOKENS_KEY);
}

export interface PendingPkce {
  codeVerifier: string;
  state: string;
}

export function savePendingPkce(pending: PendingPkce): void {
  sessionStorage.setItem(PKCE_KEY, JSON.stringify(pending));
}

export function loadPendingPkce(): PendingPkce | null {
  const raw = sessionStorage.getItem(PKCE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingPkce;
  } catch {
    return null;
  }
}

export function clearPendingPkce(): void {
  sessionStorage.removeItem(PKCE_KEY);
}

// Decodifica el payload del JWT SIN verificar firma — solo para leer claims de presentacion
// (nombre del operador, roles para ocultar/mostrar UI). El limite de confianza real es CIS
// (ZitadelAuthGuard) y CORE (verificarRolAdministradorPatrimonial) — nada de lo que se lea acá
// autoriza nada del lado del cliente (DOC-013 §4).
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
