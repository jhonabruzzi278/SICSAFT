import { z } from 'zod';
import { loadEnvConfig } from '../common/load-env-config';

// ADR-004 — a diferencia del PAT estático de Zitadel (ZITADEL_ADMIN_TOKEN, Bearer fijo sin
// refresh), Keycloak autentica automatizaciones server-to-server con el flujo `client_credentials`
// contra un client confidencial con `serviceAccountsEnabled` — el token resultante tiene vida
// corta (minutos, no indefinida), así que KeycloakAdminService lo cachea y renueva en vez de
// leerlo una sola vez al arrancar (ver keycloak-admin.service.ts, `obtenerTokenDeServicio`).
// KEYCLOAK_REALM se repite acá (no se importa de keycloak-auth.config.ts) para no invertir la
// dependencia entre common/auth/ y keycloak-admin/ — mismo criterio que ya usaba
// zitadel-admin.config.ts con ZITADEL_ISSUER.
const keycloakAdminEnvSchema = z.object({
  KEYCLOAK_URL: z.string().min(1, 'es requerido'),
  KEYCLOAK_REALM: z.string().min(1, 'es requerido'),
  KEYCLOAK_ADMIN_CLIENT_ID: z.string().min(1, 'es requerido'),
  KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().min(1, 'es requerido'),
});

export interface KeycloakAdminConfig {
  tokenUrl: string;
  adminBaseUrl: string;
  clientId: string;
  clientSecret: string;
}

export function loadKeycloakAdminConfig(
  env: NodeJS.ProcessEnv = process.env,
): KeycloakAdminConfig {
  const parsed = loadEnvConfig(keycloakAdminEnvSchema, env, 'KeycloakAdmin');
  const issuer = `${parsed.KEYCLOAK_URL}/realms/${parsed.KEYCLOAK_REALM}`;
  return {
    tokenUrl: `${issuer}/protocol/openid-connect/token`,
    adminBaseUrl: `${parsed.KEYCLOAK_URL}/admin/realms/${parsed.KEYCLOAK_REALM}`,
    clientId: parsed.KEYCLOAK_ADMIN_CLIENT_ID,
    clientSecret: parsed.KEYCLOAK_ADMIN_CLIENT_SECRET,
  };
}
