import http from 'k6/http';
import { check, sleep } from 'k6';
import { CIP_URL, ORGANIZACION_ID, cipHeaders } from '../lib/config.js';

// Carga esperada normal contra CIP — simula un Directivo/Profesional con el Dashboard abierto,
// que dispara varias consultas agregadas en paralelo al cargar la pantalla (mismo patrón que
// DashboardPage.tsx en ccp/, ver cip/src/dashboard/dashboard.controller.ts).
export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

const ENDPOINTS = ['cobertura', 'areas', 'estado-activos', 'categorias'];

export default function () {
  for (const endpoint of ENDPOINTS) {
    const res = http.get(
      `${CIP_URL}/dashboard/${endpoint}?organizacionId=${ORGANIZACION_ID}`,
      { headers: cipHeaders(), tags: { endpoint } },
    );
    check(res, { [`${endpoint} responde 200`]: (r) => r.status === 200 });
  }
  sleep(2);
}
