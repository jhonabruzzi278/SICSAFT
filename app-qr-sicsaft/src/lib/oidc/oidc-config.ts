// Config del cliente OIDC (ADR-002/ADR-004, DOC-002 sección 3) — falla rápido al importarse en vez de
// con errores crípticos a mitad del flujo de login, mismo criterio que los config loaders de
// CIS (ver cis/src/common/auth/keycloak-auth.config.ts). Variables públicas de Vite (`VITE_*`):
// esto es una SPA, no hay secreto de cliente que proteger (PKCE, ver pkce.ts).
export interface OidcConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  cisUrl: string;
}

function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `Configuración OIDC inválida: falta ${name} (ver .env.example y devops/local/README.md "Cliente OIDC real").`,
    );
  }
  return value;
}

export function loadOidcConfig(): OidcConfig {
  return {
    issuer: requireEnv('VITE_KEYCLOAK_ISSUER'),
    clientId: requireEnv('VITE_KEYCLOAK_CLIENT_ID'),
    redirectUri: `${window.location.origin}/auth/callback`,
    cisUrl: requireEnv('VITE_CIS_URL'),
  };
}
