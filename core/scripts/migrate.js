'use strict';

// Runner de migraciones — JS plano a proposito (sin ts-node) para poder correr en la imagen de
// produccion sin devDependencies. Las migraciones en migrations/*.ts se transpilan al vuelo via
// jiti, que node-pg-migrate ya trae como dependencia (ver migrations/README si se agrega).
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
      host: requireEnv('CORE_DB_HOST'),
      port: Number(process.env.CORE_DB_PORT || '5432'),
      database: requireEnv('CORE_DB_NAME'),
      user: requireEnv('CORE_DB_USER'),
      password: requireEnv('CORE_DB_PASSWORD'),
    },
    dir: 'migrations',
    // node-pg-migrate v9 escanea TODA entrada de migrations/ y exige un prefijo numerico en el
    // nombre; sin este ignorePattern, el README.md de la carpeta (o un .gitkeep, un .DS_Store)
    // rompe la carga con "Cannot determine numeric prefix". El patron ignora todo archivo cuyo
    // nombre NO empiece con digito -- las migraciones reales siempre empiezan con el timestamp.
    ignorePattern: '(?!\\d).*',
    direction,
    migrationsTable: 'pgmigrations',
    count: direction === 'down' ? 1 : Infinity,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
