import { SignJWT, type KeyLike } from 'jose';

const ZITADEL_ROLES_CLAIM = 'urn:zitadel:iam:org:project:roles';

// Antes duplicado en cada e2e-spec que necesita un JWT real firmado con roles de Zitadel
// (SonarCloud lo marcaba como duplicación real, mismo criterio que crearAppE2e en e2e-app.ts). El
// nombre de organización en el claim es solo de presentación (Zitadel lo usa para mostrar en el
// Console) — ningún spec lo asertea, por eso queda fijo acá en vez de ser otro parámetro.
export async function firmarTokenZitadel(
  privateKey: KeyLike,
  roles: Record<string, string[]>,
  opciones: { issuer: string; audience: string; subject: string },
): Promise<string> {
  return new SignJWT({
    [ZITADEL_ROLES_CLAIM]: Object.fromEntries(
      Object.entries(roles).flatMap(([org, rolesEnOrg]) =>
        rolesEnOrg.map((rol) => [rol, { [org]: 'Organización' }]),
      ),
    ),
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(opciones.subject)
    .setIssuer(opciones.issuer)
    .setAudience(opciones.audience)
    .setExpirationTime('15m')
    .sign(privateKey);
}
