// Almacenamiento del token — sessionStorage a propósito, no localStorage: el access token es un
// secreto (a diferencia de operator.ts/device-id.ts, que no lo son), y sessionStorage se pierde
// al cerrar la pestaña/PWA — el operador re-autentica cada turno en vez de dejar un token vivo
// indefinidamente en el dispositivo (decisión explícita, ver commit de TASK-007).
const TOKENS_KEY = "qrvault-oidc-tokens";
const PKCE_KEY = "qrvault-oidc-pkce";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// Solo sessionStorage, como dice el encabezado y como lo dejó el fix SEC-01..SEC-04
// (commit ca4c5df). Un cambio posterior volvió a escribir en localStorage sin tocar ese
// comentario: el token sobrevivía al cierre de la PWA y podía durar más que la sesión que lo
// respalda en Keycloak. Revertido 2026-09-08, igual que en ccp/.
export function saveTokens(tokens: StoredTokens): void {
  purgarTokenPersistido();
  sessionStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

// Restos de la versión que persistía en disco: se limpian en cada guardado y lectura.
function purgarTokenPersistido(): void {
  try {
    localStorage.removeItem(TOKENS_KEY);
  } catch {
    // localStorage puede no estar disponible; no hay nada que limpiar entonces
  }
}

// `JSON.parse` devuelve `any`: sin validar la forma, un objeto viejo o corrupto pasaba como
// StoredTokens y un `expiresAt` ausente hacía que la comparación de vencimiento diera NaN
// (siempre "no venció"), así que se mandaba un token muerto sin intentar refrescarlo.
function esStoredTokens(valor: unknown): valor is StoredTokens {
  if (typeof valor !== "object" || valor === null) return false;
  const t = valor as Record<string, unknown>;
  return (
    typeof t.accessToken === "string" &&
    t.accessToken.length > 0 &&
    typeof t.refreshToken === "string" &&
    t.refreshToken.length > 0 &&
    typeof t.expiresAt === "string" &&
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
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(payload)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}
