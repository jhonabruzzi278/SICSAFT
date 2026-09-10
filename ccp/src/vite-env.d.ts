/// <reference types="vite/client" />

// DOC-028 Fase C.0 — config OIDC que el .exe embebido de sicsaft-core inyecta en el index.html
// (static-portal-server.ts) cuando este portal corre dentro del instalador. Claves con el mismo
// nombre que las env vars VITE_* (VITE_KEYCLOAK_ISSUER, VITE_KEYCLOAK_CLIENT_ID, VITE_CIS_URL, y
// VITE_KEYCLOAK_TOKEN_URL solo en el CCP servido en la LAN — DOC-028 Fase G).
// Ausente en `npm run dev` suelto y en deploys standalone — ahí se usa import.meta.env.
interface Window {
  __SICSAFT_PORTAL_CONFIG__?: Record<string, string>;
}
