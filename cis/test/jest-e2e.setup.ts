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
