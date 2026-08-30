/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

// DOC-028 Fase C.0 / Fase D — config OIDC que el .exe embebido de sicsaft-core inyecta en el
// index.html (static-portal-server.ts) cuando esta PWA la sirve el instalador. Claves con el
// mismo nombre que las env vars VITE_* (VITE_KEYCLOAK_ISSUER, VITE_KEYCLOAK_CLIENT_ID,
// VITE_CIS_URL). Ausente en `npm run dev`/`preview` suelto y en el deploy de Vercel.
interface Window {
  __SICSAFT_PORTAL_CONFIG__?: Record<string, string>;
}
