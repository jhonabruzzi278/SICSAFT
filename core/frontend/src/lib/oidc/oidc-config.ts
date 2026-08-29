// Config del cliente OIDC (ADR-002/ADR-004) — falla rapido al importarse en vez de con errores cripticos
// a mitad del flujo de login (mismo criterio que app-qr-sicsaft/src/lib/oidc/oidc-config.ts).
export interface OidcConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  cisUrl: string;
}

// DOC-028 Fase C.0 — cuando este portal lo sirve el .exe embebido de sicsaft-core, la config OIDC
// no puede hornearse en el build de Vite: la IP de LAN de Keycloak recién se conoce en cada
// arranque y puede cambiar sin recompilar (Fase C.1). static-portal-server.ts la inyecta como
// window.__SICSAFT_PORTAL_CONFIG__; para `npm run dev` suelto y deploys standalone (Traefik,
// Vercel) eso no está y se cae a import.meta.env, como siempre.
function requireEnv(name: string): string {
  const value =
    window.__SICSAFT_PORTAL_CONFIG__?.[name] || import.meta.env[name];
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
