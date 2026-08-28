// Almacenamiento del token — sessionStorage a propósito, no localStorage: el access token es un
// secreto (a diferencia de operator.ts/device-id.ts, que no lo son), y sessionStorage se pierde
// al cerrar la pestaña/PWA — el operador re-autentica cada turno en vez de dejar un token vivo
// indefinidamente en el dispositivo (decisión explícita, ver commit de TASK-007).
const TOKENS_KEY = 'qrvault-oidc-tokens';
const PKCE_KEY = 'qrvault-oidc-pkce';

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

// Vive solo entre el redirect a Keycloak y la vuelta a /auth/callback — se limpia apenas se usa.
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

// Decodifica el payload del JWT SIN verificar firma — únicamente para leer claims de
// presentación (nombre del operador a mostrar en la UI). El límite de confianza real es CIS, que
// sí valida firma/issuer/audience/vencimiento (KeycloakAuthGuard) en cada request; nada acá se usa
// para autorizar nada del lado del cliente.
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
