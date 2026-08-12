// Default para que cualquier e2e spec que compile AppModule (y por lo tanto ServiceTokenModule)
// no falle por config faltante — ver src/common/auth/service-token.config.ts. Los specs que
// necesitan probar el guard de verdad (entitlements.e2e-spec.ts) usan este mismo valor para
// armar el header esperado.
process.env.CORE_SERVICE_TOKEN ??= 'secreto-compartido-e2e';
