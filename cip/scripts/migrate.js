'use strict';

// Runner de migraciones — mismo mecanismo que core/scripts/migrate.js (JS plano, sin ts-node,
// para poder correr en la imagen de produccion sin devDependencies).
const { runner } = require('node-pg-migrate');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Configuracion de base de datos invalida: falta ${name}`);
  }
  return value;
}

async function main() {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';

  await runner({
    databaseUrl: {
      host: requireEnv('CIP_DB_HOST'),
      port: Number(process.env.CIP_DB_PORT || '5432'),
      database: requireEnv('CIP_DB_NAME'),
      user: requireEnv('CIP_DB_USER'),
      password: requireEnv('CIP_DB_PASSWORD'),
    },
    dir: 'migrations',
    direction,
    migrationsTable: 'pgmigrations',
    count: direction === 'down' ? 1 : Infinity,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
