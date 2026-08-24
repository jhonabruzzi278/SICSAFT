import http from 'k6/http';
import { check } from 'k6';
import { CIS_URL, CORE_URL, CIP_URL } from '../lib/config.js';

// Smoke test — carga mínima, corre siempre primero. Si esto falla no tiene sentido correr load/
// ni stress/ todavía: confirma que los 3 backends responden antes de cargarlos de verdad.
export const options = {
  vus: 1,
  iterations: 3,
  thresholds: {
    http_req_failed: ['rate==0'],
    http_req_duration: ['p(95)<500'],
  },
};

const SERVICIOS = [
  ['cis', `${CIS_URL}/health`],
  ['core', `${CORE_URL}/health`],
  ['cip', `${CIP_URL}/health`],
];

export default function () {
  for (const [nombre, url] of SERVICIOS) {
    const res = http.get(url, { tags: { servicio: nombre } });
    check(res, { [`${nombre} /health responde 200`]: (r) => r.status === 200 });
  }
}
