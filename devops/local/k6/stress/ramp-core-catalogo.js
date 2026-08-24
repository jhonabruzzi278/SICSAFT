import http from 'k6/http';
import { check, sleep } from 'k6';
import { CORE_URL, ORGANIZACION_ID, coreHeaders } from '../lib/config.js';

// Estrés — sube VUs bien por encima de la carga esperada (load/core-catalogo.js usa 20) para
// encontrar dónde se degrada el p95 o empiezan a aparecer errores. Sin thresholds que aborten el
// test: el objetivo es observar dónde se rompe, no pasar/fallar un gate — mirar el resultado en
// Grafana (dashboard 18030, ver README.md) en vez de la salida de la consola.
export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.get(
    `${CORE_URL}/catalogo?organizacionId=${ORGANIZACION_ID}&limit=20&offset=0`,
    { headers: coreHeaders(), tags: { endpoint: 'catalogo' } },
  );
  check(res, { 'responde 200': (r) => r.status === 200 });
  sleep(0.5);
}
