// Defaults para que cualquier e2e spec que compile AppModule (y por lo tanto ZitadelAuthModule y
// CoreClientModule) no falle por config faltante — ver src/common/auth/zitadel-auth.config.ts y
// src/core-client/core-client.config.ts. Los specs que necesitan probar el guard/cliente de
// verdad (qr-connector.e2e-spec.ts) sobreescriben estos valores y además reemplazan los
// proveedores de JWKS/CoreClientService (no hay Zitadel ni CORE reales en CI).
process.env.ZITADEL_ISSUER ??= 'http://id.sicsaft.localhost';
process.env.ZITADEL_AUDIENCE ??= 'cis-api';
// http a proposito — red interna de Docker Compose sin TLS local (mismo patron que Zitadel
// arriba, ZITADEL_EXTERNALSECURE=false), y este valor solo se usa en tests.
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
// DOC-012 5 (Fase 5) — ver src/administrador/organizacion-mapping.config.ts.
process.env.ZITADEL_ORG_ID_MAP ??= '{"386029528616558597":"duoc-uc"}';
