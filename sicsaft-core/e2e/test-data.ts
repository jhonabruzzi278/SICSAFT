// Constantes del harness del `.exe`: puertos de los servidores embebidos, org y usuarios de
// laboratorio. El `.exe` sirve cada portal en 127.0.0.1:<puerto> por HTTP plano -- 127.0.0.1 ES
// secure context para la Web Platform, así que crypto.subtle/PKCE funcionan sin TLS
// (ver src/main/services/static-portal-server.ts).

export const PUERTOS = {
  postgres: 55432,
  keycloak: 58080,
  keycloakManagement: 58081,
  cis: 56000,
  core: 56001,
  cip: 56002,
  ccp: 8766,
  coreFrontend: 8768,
  appQr: 8765,
  // DOC-028 Fase G -- CCP servido en la IP de LAN por HTTPS (puesto del AFT en otra PC).
  ccpLan: 8767,
} as const;

export const URLS = {
  keycloak: `http://127.0.0.1:${PUERTOS.keycloak}`,
  keycloakIssuer: `http://127.0.0.1:${PUERTOS.keycloak}/realms/sicsaft`,
  cis: `http://127.0.0.1:${PUERTOS.cis}`,
  ccp: `http://127.0.0.1:${PUERTOS.ccp}`,
  directivo: `http://127.0.0.1:${PUERTOS.coreFrontend}`,
} as const;

export const REALM = "sicsaft";

// Org de laboratorio que crea el wizard (paso 1). El identificador se autocompleta a partir del
// nombre en PasoDatosCliente.tsx (slug: minúsculas, números, guiones).
export const ORG = {
  nombre: "Organizacion E2E Playwright",
  id: "organizacion-e2e-playwright",
  sede: "Casa Central",
  sedeId: "organizacion-e2e-playwright-casa-central",
  nivel: 2 as 1 | 2,
} as const;

// Emails con TLD `.test` (RFC 2606): los portales y cis/src/directivo/directivo.schemas.ts
// validan con `zod.string().email()`, cuyo regex exige un TLD alfabético -- un TLD con dígito
// (`.e2e`) se rechaza como "Email inválido".
export const USUARIOS = {
  director: {
    email: "director-e2e@organizacion-e2e-playwright.test",
    // El rol que el `.exe` mapea a "Directivo" (portal core/frontend) -- ver
    // src/main/services/portal-login-service.ts ROL_DIRECTIVO.
    rol: "directivo",
  },
  aft: {
    email: "aft-e2e@organizacion-e2e-playwright.test",
    // El rol real que ccp/ exige y que "Designar Profesional de AFT" asigna -- ver
    // portal-login-service.ts ROL_PROFESIONAL_AFT.
    rol: "administrador-patrimonial",
  },
} as const;

// Clave nueva que las specs fijan en la pantalla "Update password" de Keycloak (todo usuario
// recién provisionado la trae forzada en su primer login). Cumple la política por defecto.
export const CLAVE_NUEVA = "PruebaE2E-Playwright-2026";
