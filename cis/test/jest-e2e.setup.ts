// Defaults para que cualquier e2e spec que compile AppModule (y por lo tanto ZitadelAuthModule)
// no falle por config faltante — ver src/common/auth/zitadel-auth.config.ts. Los specs que
// necesitan probar el guard de verdad (qr-connector.e2e-spec.ts) sobreescriben estos valores y
// además reemplazan el proveedor de JWKS por uno local (no hay Zitadel real en CI).
process.env.ZITADEL_ISSUER ??= 'http://id.sicsaft.localhost';
process.env.ZITADEL_AUDIENCE ??= 'cis-api';
