import { z } from 'zod';
import { loadEnvConfig } from '../load-env-config';

// Ver ADR-002 (adr/ADR-002-identidad-zitadel-multi-tenant.md): Zitadel es el IdP OIDC
// (authorization code + PKCE) para WEB/APP QR. El CIS nunca ve credenciales — solo valida el
// access token que el cliente ya obtuvo de Zitadel.
//
// `issuer` es el valor que Zitadel pone en el claim `iss` del token (su ZITADEL_EXTERNALDOMAIN,
// ej. `http://id.sicsaft.localhost`) — se usa para validar el token, no para alcanzar la red.
// `jwksUri` es la URL desde la que el CIS efectivamente descarga las llaves públicas; en Docker
// Compose local eso NO es `issuer` (ese dominio solo resuelve via el hosts file del host, no
// dentro de la red de contenedores) sino el nombre de servicio interno (`http://zitadel:8080/...`)
// — por eso son dos variables separadas en vez de derivar una de la otra.
const zitadelAuthEnvSchema = z.object({
  ZITADEL_ISSUER: z.string().min(1, 'es requerido'),
  ZITADEL_AUDIENCE: z.string().min(1, 'es requerido'),
  ZITADEL_JWKS_URI: z.string().min(1).optional(),
});

export interface ZitadelAuthConfig {
  issuer: string;
  audience: string;
  jwksUri: string;
}

export function loadZitadelAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): ZitadelAuthConfig {
  const { ZITADEL_ISSUER, ZITADEL_AUDIENCE, ZITADEL_JWKS_URI } = loadEnvConfig(
    zitadelAuthEnvSchema,
    env,
    'Zitadel',
  );
  return {
    issuer: ZITADEL_ISSUER,
    audience: ZITADEL_AUDIENCE,
    jwksUri: ZITADEL_JWKS_URI ?? `${ZITADEL_ISSUER}/oauth/v2/keys`,
  };
}
