// Default para que cualquier e2e spec que compile AppModule (y por lo tanto ServiceTokenModule)
// no falle por config faltante — ver src/common/auth/service-token.config.ts. Los specs que
// necesitan probar el guard de verdad (entitlements.e2e-spec.ts) usan este mismo valor para
// armar el header esperado.
process.env.CORE_SERVICE_TOKEN ??= 'secreto-compartido-e2e';

// Default para DatabaseModule (ver src/database/database.config.ts) — apunta al postgres del
// docker-compose local (devops/local/docker-compose.yml, puerto expuesto al host) con el
// esquema de devops/local/postgres/init/schema/core.sql ya aplicado. CI (core-ci.yml) sobreescribe
// estos valores con los del servicio postgres del job.
process.env.CORE_DB_HOST ??= 'localhost';
process.env.CORE_DB_PORT ??= '5432';
process.env.CORE_DB_NAME ??= 'core';
process.env.CORE_DB_USER ??= 'core';
process.env.CORE_DB_PASSWORD ??= 'core';

// Fase 6 (EventosOutboxModule) — mismo criterio que CORE_DB_* arriba. `core-ci.yml` levanta un
// Redis efímero sin password (limitación de `services:` de GitHub Actions, que no permite pasar
// `--requirepass` sin una imagen custom); el `redis` de `devops/local/docker-compose.yml` sí
// exige `REDIS_PASSWORD` — si tu `.env` local lo cambió del default, exportá REDIS_URL antes de
// correr `npm run test:e2e` fuera de Docker.
process.env.REDIS_URL ??= 'redis://localhost:6379';
