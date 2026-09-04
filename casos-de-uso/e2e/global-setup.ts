import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { instalarResolucionLocalhost } from './scripts/localhost-agent.mjs';
import { up } from './scripts/stack.mjs';
import { esperarHttp } from './scripts/wait.mjs';
import { seedKeycloak } from './scripts/keycloak-seed.mjs';
import { DOMINIO_BASE, ORG_ID, ORG_NOMBRE, URLS, USUARIOS } from './test-data.mjs';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(RAIZ, '.env');
const ENV_EXAMPLE = path.join(RAIZ, '.env.example');

// Fases del arranque:
//   1. infra (postgres, keycloak, traefik).
//   2. bootstrap de Keycloak → devuelve el secret de `cis-admin`, que se escribe en .env.
//   3. resto del stack (core-migrate corre el seed DUOC UC, luego core/cip/cis/portales) — ya con
//      el secret real en .env para que cis lo tome.
//   4. poll HTTP del ingress (prueba además que Traefik rutea).
export default async function globalSetup(): Promise<void> {
  instalarResolucionLocalhost();
  if (!existsSync(ENV_PATH)) {
    copyFileSync(ENV_EXAMPLE, ENV_PATH);
    console.log('[casos-de-uso] .env generado desde .env.example');
  }
  const t0 = Date.now();

  console.log('\n[casos-de-uso] 1/4  Infra: postgres + keycloak + traefik (build la 1ª vez)…');
  up(['postgres', 'keycloak', 'traefik']);

  console.log('[casos-de-uso] 2/4  Esperando a Keycloak…');
  await esperarHttp(`${URLS.keycloak}/realms/master/.well-known/openid-configuration`, {
    nombre: 'Keycloak',
    intentos: 120,
    aceptar: (s) => s === 200,
  });

  console.log('[casos-de-uso] 3/4  Bootstrap de Keycloak (realm, org, clientes, usuarios)…');
  const { cisAdminSecret } = await seedKeycloak({
    keycloakUrl: URLS.keycloak,
    admin: { usuario: 'admin', password: 'admin' },
    orgId: ORG_ID,
    orgNombre: ORG_NOMBRE,
    dominioBase: DOMINIO_BASE,
    usuarios: USUARIOS,
  });
  writeFileSync(
    ENV_PATH,
    readFileSync(ENV_PATH, 'utf8').replace(
      /^KEYCLOAK_ADMIN_CLIENT_SECRET=.*$/m,
      `KEYCLOAK_ADMIN_CLIENT_SECRET=${cisAdminSecret}`,
    ),
  );

  console.log('[casos-de-uso] 3/4  Resto del stack: core (+seed DUOC UC), cip, cis, portales…');
  up(['core-migrate', 'core', 'cip-migrate', 'cip', 'cis', 'ccp', 'core-frontend']);

  console.log('[casos-de-uso] 4/4  Esperando al ingress (Traefik → CIS / CCP / Directivo)…');
  await esperarHttp(`${URLS.cis}/health`, { nombre: 'CIS /health', intentos: 120, aceptar: (s) => s === 200 });
  await esperarHttp(`${URLS.ccp}/`, { nombre: 'CCP', intentos: 60 });
  await esperarHttp(`${URLS.directivo}/`, { nombre: 'Directivo', intentos: 60 });

  console.log(`[casos-de-uso] stack listo en ${Math.round((Date.now() - t0) / 1000)}s\n`);
}
