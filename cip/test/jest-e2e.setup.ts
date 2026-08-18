// Mismo mecanismo que core/test/jest-e2e.setup.ts — defaults para que cualquier e2e spec que
// compile AppModule no falle por config faltante. CI (cip-ci.yml) sobreescribe estos valores con
// los del servicio postgres/redis del job.
process.env.CIP_DB_HOST ??= 'localhost';
process.env.CIP_DB_PORT ??= '5432';
process.env.CIP_DB_NAME ??= 'cip';
process.env.CIP_DB_USER ??= 'cip';
process.env.CIP_DB_PASSWORD ??= 'cip';
process.env.CIP_SERVICE_TOKEN ??= 'secreto-compartido-e2e';
process.env.CORE_URL ??= 'http://localhost:3001';
process.env.CORE_SERVICE_TOKEN ??= 'secreto-compartido-e2e';
process.env.REDIS_URL ??= 'redis://localhost:6379';
