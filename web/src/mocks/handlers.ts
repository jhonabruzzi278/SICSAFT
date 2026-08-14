// Handlers de MSW para los endpoints de CIS que ejercita el flujo login+alta (DOC-006, DOC-012
// §5) — solo se registran en modo mock (ver src/main.tsx, VITE_MOCK_API). Zitadel nunca se
// mockea acá: CIS es quien valida el JWT server-side, el cliente solo mira si hay tokens
// guardados (oidcClient.isAuthenticated(), sessionStorage) — mismo criterio que
// app-qr-sicsaft/src/mocks/handlers.ts.
import { http, HttpResponse } from 'msw';
import type { Activo, ActivoCatalogo } from '@/lib/cis-client';
import { MOCK_CATALOGO, MOCK_ORGANIZACIONES } from './fixtures';

const CIS_URL = import.meta.env.VITE_CIS_URL;

// Estado mutable propio del catálogo mockeado — RF-08 exige que un alta sea visible de inmediato
// en el mismo catálogo (ver ActivosPage.tsx, cargarCatalogo() se vuelve a llamar tras el submit),
// así que el handler de alta necesita que el de listado refleje lo recién creado.
let catalogo: ActivoCatalogo[] = [...MOCK_CATALOGO];

export function resetCatalogo(): void {
  catalogo = [...MOCK_CATALOGO];
}

export const defaultHandlers = [
  http.post(`${CIS_URL}/auth/session`, () =>
    HttpResponse.json({ organizaciones: MOCK_ORGANIZACIONES }),
  ),

  http.get(`${CIS_URL}/catalogo`, ({ request }) => {
    const url = new URL(request.url);
    const organizacionId = url.searchParams.get('organizacionId');
    const activos = catalogo.filter((a) => a.organizacionId === organizacionId);
    return HttpResponse.json({ activos });
  }),

  http.post(`${CIS_URL}/admin/activos`, async ({ request }) => {
    const body = (await request.json()) as {
      organizacionId: string;
      codigoPatrimonial: string;
      codigoQr: string;
      catalogoId: string;
      areaId?: string;
      ubicacionId?: string;
    };
    catalogo.push({
      codigoQr: body.codigoQr,
      nombre: `Activo ${body.codigoPatrimonial}`,
      organizacionId: body.organizacionId,
      areaId: body.areaId ?? '',
      ubicacionId: body.ubicacionId ?? '',
      estado: 'activo',
    });
    const activo: Activo = {
      id: crypto.randomUUID(),
      codigoPatrimonial: body.codigoPatrimonial,
      codigoQr: body.codigoQr,
      organizacionId: body.organizacionId,
      areaId: body.areaId ?? null,
      ubicacionId: body.ubicacionId ?? null,
      responsableId: null,
      estado: 'activo',
      catalogo: { tipo: 'equipo', familia: 'tecnologia', subfamilia: null, marca: null, modelo: null },
    };
    return HttpResponse.json(activo, { status: 201 });
  }),
];
