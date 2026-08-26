// Defaults para que cualquier e2e spec que compile AppModule (y por lo tanto KeycloakAuthModule,
// KeycloakAdminModule y CoreClientModule) no falle por config faltante — ver
// src/common/auth/keycloak-auth.config.ts, src/keycloak-admin/keycloak-admin.config.ts y
// src/core-client/core-client.config.ts. Los specs que necesitan probar el guard/cliente de
// verdad (qr-connector.e2e-spec.ts) firman sus JWT de prueba contra estos mismos valores y además
// reemplazan los proveedores de JWKS/CoreClientService/KeycloakAdminService (no hay Keycloak ni
// CORE reales en CI).
process.env.KEYCLOAK_URL ??= 'http://id.sicsaft.localhost';
process.env.KEYCLOAK_REALM ??= 'sicsaft';
process.env.KEYCLOAK_AUDIENCE ??= 'cis-api';
// ADR-004 — igual criterio que CORE_URL abajo: KeycloakAdminModule exige esta config al arrancar
// (client_credentials contra un client confidencial) aunque el test no le hable a Keycloak de
// verdad — ver keycloak-admin.config.ts.
process.env.KEYCLOAK_ADMIN_CLIENT_ID ??= 'cis-admin-e2e';
process.env.KEYCLOAK_ADMIN_CLIENT_SECRET ??= 'secreto-e2e'; // NOSONAR
// http a proposito — red interna de Docker Compose sin TLS local (mismo patron que Keycloak
// arriba), y este valor solo se usa en tests.
process.env.CORE_URL ??= 'http://core:3001'; // NOSONAR
process.env.CORE_SERVICE_TOKEN ??= 'secreto-compartido';
// DOC-019 3.1 — igual criterio que CORE_URL arriba: CipClientModule (dashboard-connector) exige
// esta config al arrancar aunque el test no le hable a CIP de verdad.
process.env.CIP_URL ??= 'http://cip:3002'; // NOSONAR
process.env.CIP_SERVICE_TOKEN ??= 'secreto-compartido-cip';
// Igual que CORE_URL arriba: solo hace falta para que RateLimitModule cargue su config al
// arrancar (RATE_LIMIT_CONFIG usa `lazyConnect`, nunca conecta de verdad en estos tests) —
// qr-connector.e2e-spec.ts además reemplaza el proveedor REDIS_CLIENT por un stub.
process.env.REDIS_URL ??= 'redis://localhost:6379'; // NOSONAR
