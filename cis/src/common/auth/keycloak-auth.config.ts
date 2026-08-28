import { z } from 'zod';
import { loadEnvConfig } from '../load-env-config';

// ADR-004 — Keycloak reemplaza a Zitadel. `KEYCLOAK_URL` es la URL base del servidor (ej.
// http://keycloak:8080 dentro de la red de contenedores, o https://id.sicsaft.cl en prod);
// `issuer` se arma agregando `/realms/{realm}` (mismo criterio que ya usaba ZITADEL_ISSUER, salvo
// que ahí el issuer YA era la URL completa — acá Keycloak expone el realm como sub-path del mismo
// host, no como dominio propio). `KEYCLOAK_JWKS_URI` sigue existiendo como override explícito por
// el mismo motivo que antes: el issuer externo (dominio público) no resuelve dentro de la red de
// contenedores/procesos, así que el JWKS real a veces hay que pedirlo contra el nombre de servicio
// interno.
const keycloakAuthEnvSchema = z.object({
  KEYCLOAK_URL: z.string().min(1, 'es requerido'),
  KEYCLOAK_REALM: z.string().min(1, 'es requerido'),
  KEYCLOAK_AUDIENCE: z.string().min(1, 'es requerido'),
  KEYCLOAK_JWKS_URI: z.string().min(1).optional(),
});

export interface KeycloakAuthConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
}

export function loadKeycloakAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): KeycloakAuthConfig {
  const { KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_AUDIENCE, KEYCLOAK_JWKS_URI } =
    loadEnvConfig(keycloakAuthEnvSchema, env, 'KeycloakAuth');
  const issuer = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;
  return {
    issuer,
    audience: KEYCLOAK_AUDIENCE,
    jwksUri: KEYCLOAK_JWKS_URI ?? `${issuer}/protocol/openid-connect/certs`,
  };
}
