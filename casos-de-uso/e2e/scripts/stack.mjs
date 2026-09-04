// Wrapper delgado sobre `docker compose` para el harness. El ciclo de vida del stack lo maneja
// global-setup / global-teardown; este módulo sólo centraliza el nombre de proyecto y el
// --env-file.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(DIR, '..');
export const PROYECTO = 'sicsaft-cu-e2e';
const ENV_FILE = path.join(RAIZ, '.env');

/**
 * @param {string[]} args  argumentos después de `docker compose -p <proyecto> --env-file .env`
 */
export function compose(args) {
  const full = ['compose', '-p', PROYECTO, '--env-file', ENV_FILE, ...args];
  const r = spawnSync('docker', full, { cwd: RAIZ, stdio: 'inherit' });
  if (r.error) {
    throw new Error(
      `No se pudo ejecutar 'docker' — ¿está Docker Desktop corriendo y en el PATH? (${r.error.message})`,
    );
  }
  if (r.status !== 0) {
    throw new Error(`docker ${full.join(' ')} → exit ${r.status}`);
  }
}

/**
 * `up -d --build` de un subconjunto de servicios. Sin `--wait`: los readiness reales los
 * comprueba global-setup por HTTP (además prueba que Traefik ya rutea).
 * @param {string[]} servicios
 */
export function up(servicios) {
  compose(['up', '-d', '--build', ...servicios]);
}

export function down() {
  compose(['down', '-v', '--remove-orphans']);
}

// CLI mínima para depuración: `node scripts/stack.mjs down`
const modo = process.argv[2];
if (modo === 'down') {
  down();
} else if (modo === 'ps') {
  compose(['ps']);
} else if (modo) {
  console.error(
    `Modo '${modo}' no soportado. El stack lo levanta \`npm test\` (global-setup). Usá 'down' o 'ps'.`,
  );
  process.exit(1);
}
