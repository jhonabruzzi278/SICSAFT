// Config del cliente OIDC (ADR-002/ADR-004) — falla rapido al importarse en vez de con errores cripticos
// a mitad del flujo de login (mismo criterio que app-qr-sicsaft/src/lib/oidc/oidc-config.ts).
export interface OidcConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  cisUrl: string;
  // DOC-028 Fase G — URL del token endpoint cuando no es la del issuer. Solo la trae el CCP que el
  // .exe sirve en la LAN por HTTPS (puesto del Profesional de AFT en su propia PC): ahí el canje
  // del código y el refresh van por el proxy de mismo origen del propio servidor (`/kc/token`),
  // porque un fetch de una página HTTPS a Keycloak por HTTP es contenido mixto (Firefox y los
  // Chromium sin Local Network Access lo bloquean). Ausente → `<issuer>/protocol/openid-connect/token`,
  // como siempre.
  tokenUrl?: string;
}

// DOC-028 Fase C.0 — cuando este portal lo sirve el .exe embebido de sicsaft-core, la config OIDC
// no puede hornearse en el build de Vite: la IP de LAN de Keycloak recién se conoce en cada
// arranque y puede cambiar sin recompilar (Fase C.1). static-portal-server.ts la inyecta como
// window.__SICSAFT_PORTAL_CONFIG__; para `npm run dev` suelto y deploys standalone (Traefik,
// Vercel) eso no está y se cae a import.meta.env, como siempre.
function optionalEnv(name: string): string | undefined {
  const value =
    window.__SICSAFT_PORTAL_CONFIG__?.[name] || import.meta.env[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requireEnv(name: string): string {
  const value = optionalEnv(name);
  if (value === undefined) {
    throw new Error(
      `Configuración OIDC inválida: falta ${name} (ver .env.example y devops/local/README.md "Cliente OIDC real").`,
    );
  }
  return value;
}

export function loadOidcConfig(): OidcConfig {
  const tokenUrl = optionalEnv('VITE_KEYCLOAK_TOKEN_URL');
  return {
    issuer: requireEnv('VITE_KEYCLOAK_ISSUER'),
    clientId: requireEnv('VITE_KEYCLOAK_CLIENT_ID'),
    redirectUri: `${window.location.origin}/auth/callback`,
    cisUrl: requireEnv('VITE_CIS_URL'),
    ...(tokenUrl ? { tokenUrl } : {}),
  };
}
