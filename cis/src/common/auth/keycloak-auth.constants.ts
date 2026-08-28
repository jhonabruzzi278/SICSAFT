export const KEYCLOAK_AUTH_CONFIG = Symbol('KEYCLOAK_AUTH_CONFIG');
export const KEYCLOAK_JWKS = Symbol('KEYCLOAK_JWKS');

// TTL de la caché en memoria de rolesPorOrganizacion (ver keycloak-auth.guard.ts) — Keycloak no
// anida roles por organización en el propio JWT (verificado real contra un Keycloak 26.6 de
// prueba: `realm_access.roles` es una lista plana por usuario, no por organización), así que hay
// que resolverlo con una llamada aparte al Admin API en cada request. Corto a propósito: prioriza
// que un cambio de rol se refleje rápido sobre ahorrar llamadas — mismo criterio que ya usa
// ZitadelAuthContext hoy (JWT de vida corta, ~15 min) pero más chico porque acá la caché es
// nuestra, no del proveedor de identidad.
export const ROLES_POR_ORGANIZACION_CACHE_TTL_MS = 30_000;

// Separador entre organizacionId y rol en el nombre del grupo de Keycloak que representa "este
// usuario tiene este rol en esta organización" — ver keycloak-admin.service.ts. `::` en vez de un
// solo caracter para que nunca choque con un organizacionId o un nombre de rol reales (ninguno de
// los dos usa `:`, ver ADR-004 y los roles de negocio ya existentes).
export const GRUPO_ORGANIZACION_ROL_SEPARADOR = '::';
