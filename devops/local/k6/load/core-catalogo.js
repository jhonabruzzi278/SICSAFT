import http from 'k6/http';
import { check, sleep } from 'k6';
import { CORE_URL, ORGANIZACION_ID, coreHeaders } from '../lib/config.js';

// Carga esperada normal contra CORE — GET /catalogo es el endpoint más consultado en operación
// real (toda pantalla de Activos y todo escaneo de APP QR pasa por acá, ver DOC-006). 20 VUs
// sostenidos simula un equipo de Profesionales de AFT trabajando a la vez, no un pico extremo
// (ver stress/ramp.js para eso).
export const options = {
  stages: [
    { duration: '10s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
  },
};

export default function () {
  const res = http.get(
    `${CORE_URL}/catalogo?organizacionId=${ORGANIZACION_ID}&limit=20&offset=0`,
    { headers: coreHeaders(), tags: { endpoint: 'catalogo' } },
  );
  check(res, {
    'catalogo responde 200': (r) => r.status === 200,
    'catalogo trae total en el body': (r) => JSON.parse(r.body).total !== undefined,
  });
  sleep(1);
}
