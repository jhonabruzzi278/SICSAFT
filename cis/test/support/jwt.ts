import { SignJWT, type KeyLike } from 'jose';

// ADR-004 — reemplaza a firmarTokenZitadel. Keycloak no anida roles por organización en el JWT
// (ver el comentario de keycloak-auth.guard.ts): el token de prueba solo firma el claim
// `organization` (las organizaciones a las que el usuario dice pertenecer, igual que el mapper
// real `oidc-organization-membership-mapper`) — los roles efectivos por organización los resuelve
// KeycloakAuthGuard llamando a KeycloakAdminService.resolverRolesPorOrganizacionDeUsuario, que
// cada e2e-spec stubea por separado (ver crearAppE2e, opción `keycloakAdminService`).
export async function firmarTokenKeycloak(
  privateKey: KeyLike,
  organizaciones: string[],
  opciones: { issuer: string; audience: string; subject: string },
): Promise<string> {
  return new SignJWT({ organization: organizaciones })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(opciones.subject)
    .setIssuer(opciones.issuer)
    .setAudience(opciones.audience)
    .setExpirationTime('15m')
    .sign(privateKey);
}
