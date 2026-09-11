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

// Solo sessionStorage, como dice el encabezado. Hasta 2026-09-08 esto escribía ADEMÁS en
// localStorage y `loadTokens` lo leía primero, así que el token sobrevivía al cierre de la app
// y podía durar más que la sesión que lo respalda en Keycloak: el portal se mostraba logueado
// con un token que el servidor ya no reconocía.
export function saveTokens(tokens: StoredTokens): void {
  purgarTokenPersistido();
  sessionStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

// Restos de la versión que persistía en localStorage. Se limpian en cada guardado/lectura para
// que una instalación ya usada no se quede con un token muerto en disco.
function purgarTokenPersistido(): void {
  try {
    localStorage.removeItem(TOKENS_KEY);
  } catch {
    // localStorage puede no estar disponible; no hay nada que limpiar entonces
  }
}

// `JSON.parse` devuelve `any`: sin esta validación un objeto viejo o corrupto pasaba como
// StoredTokens y `expiresAt: undefined` hacía que isExpired() calculara con NaN y respondiera
// "no venció" — el cliente mandaba un token muerto para siempre sin intentar refrescarlo.
function esStoredTokens(valor: unknown): valor is StoredTokens {
  if (typeof valor !== 'object' || valor === null) return false;
  const t = valor as Record<string, unknown>;
  return (
    typeof t.accessToken === 'string' &&
    t.accessToken.length > 0 &&
    typeof t.refreshToken === 'string' &&
    t.refreshToken.length > 0 &&
    typeof t.expiresAt === 'string' &&
    Number.isFinite(new Date(t.expiresAt).getTime())
  );
}

export function loadTokens(): StoredTokens | null {
  purgarTokenPersistido();
  const raw = sessionStorage.getItem(TOKENS_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearTokens();
    return null;
  }
  if (!esStoredTokens(parsed)) {
    clearTokens();
    return null;
  }
  return parsed;
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(TOKENS_KEY);
  } catch {
    // fallback
  }
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
// (KeycloakAuthGuard) y CORE (verificarRolAdministradorPatrimonial) — nada de lo que se lea acá
// autoriza nada del lado del cliente (DOC-013 4).
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
