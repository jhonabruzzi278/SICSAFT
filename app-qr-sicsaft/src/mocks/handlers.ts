// Handlers de MSW para los 4 endpoints reales de CIS que usa qr-connector.ts (DOC-006) — sólo se
// registran en modo mock (ver src/main.tsx, VITE_MOCK_API). Zitadel nunca se mockea acá: CIS es
// quien valida el JWT server-side, el cliente sólo mira si hay tokens guardados
// (oidcClient.isAuthenticated(), sessionStorage) — ver plan de e2e en HANDOFF §7.
import { http, HttpResponse } from 'msw';
import { MOCK_CATALOGO, MOCK_ORGANIZACIONES } from './fixtures';

const CIS_URL = import.meta.env.VITE_CIS_URL;

export const defaultHandlers = [
  http.post(`${CIS_URL}/auth/session`, () =>
    HttpResponse.json({
      accessToken: 'mock-access-token',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      organizaciones: MOCK_ORGANIZACIONES,
    }),
  ),

  http.get(`${CIS_URL}/catalogo`, ({ request }) => {
    const url = new URL(request.url);
    const organizacionId = url.searchParams.get('organizacionId');
    const areaId = url.searchParams.get('areaId');
    const ubicacionId = url.searchParams.get('ubicacionId');

    const activos = MOCK_CATALOGO.filter(
      (a) =>
        a.organizacionId === organizacionId &&
        (!areaId || a.areaId === areaId) &&
        (!ubicacionId || a.ubicacionId === ubicacionId),
    );
    return HttpResponse.json({ activos });
  }),

  http.post(`${CIS_URL}/inventarios`, () =>
    HttpResponse.json({ inventarioId: crypto.randomUUID(), estado: 'recibido' }),
  ),

  http.get(`${CIS_URL}/inventarios/:id/estado`, () =>
    HttpResponse.json({ estado: 'recibido', ultimoIntento: new Date().toISOString() }),
  ),
];

// Override para sync-queue.spec.js — HttpResponse.error() simula una falla de red real (fetch()
// rechaza), no un 4xx/5xx de servidor, que es lo que sync-queue.ts trata como transitorio
// (reintenta con backoff) en vez de rechazo permanente.
export const inventarioFailureHandler = http.post(`${CIS_URL}/inventarios`, () =>
  HttpResponse.error(),
);
