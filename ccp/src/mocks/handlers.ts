// Handlers de MSW para los endpoints de CIS que ejercita el flujo login+alta (DOC-006, DOC-012
// 5) — solo se registran en modo mock (ver src/main.tsx, VITE_MOCK_API). Keycloak nunca se
// mockea acá: CIS es quien valida el JWT server-side, el cliente solo mira si hay tokens
// guardados (oidcClient.isAuthenticated(), sessionStorage) — mismo criterio que
// app-qr-sicsaft/src/mocks/handlers.ts.
import { http, HttpResponse } from 'msw';
import type {
  Activo,
  ActivoCatalogo,
  CatalogoTipoActivo,
} from '@/lib/cis-client';
import { MOCK_CATALOGO, MOCK_ORGANIZACIONES, MOCK_SYNC } from './fixtures';

// DOC-021 4 (gap "familias/categorías") — mismo id de catálogo que ya usaba el fixture de Activo
// antes de este incremento ('catalogo-notebook'), ahora servido por un endpoint real en vez de
// texto libre.
const MOCK_CATALOGO_TIPOS: CatalogoTipoActivo[] = [
  {
    id: 'catalogo-notebook',
    tipo: 'Equipo Computacional',
    familia: 'Informática',
    subfamilia: 'Notebook',
    marca: null,
    modelo: null,
    fabricante: null,
    vidaUtilMeses: null,
    criticidad: 'media',
    tecnologiaIdentificacion: 'qr',
  },
];

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

  http.get(`${CIS_URL}/admin/catalogo-tipos`, () =>
    HttpResponse.json(MOCK_CATALOGO_TIPOS),
  ),

  http.post(`${CIS_URL}/admin/activos`, async ({ request }) => {
    const body = (await request.json()) as {
      organizacionId: string;
      codigoPatrimonial: string;
      codigoQr: string;
      catalogoId: string;
      areaId?: string;
      ubicacionId?: string;
    };
    const nuevoId = crypto.randomUUID();
    catalogo.push({
      id: nuevoId,
      codigoQr: body.codigoQr,
      nombre: `Activo ${body.codigoPatrimonial}`,
      organizacionId: body.organizacionId,
      areaId: body.areaId ?? '',
      ubicacionId: body.ubicacionId ?? '',
      estado: 'activo',
    });
    const activo: Activo = {
      id: nuevoId,
      codigoPatrimonial: body.codigoPatrimonial,
      codigoQr: body.codigoQr,
      organizacionId: body.organizacionId,
      areaId: body.areaId ?? null,
      ubicacionId: body.ubicacionId ?? null,
      responsableId: null,
      estado: 'activo',
      descripcion: null,
      catalogo: {
        tipo: 'equipo',
        familia: 'tecnologia',
        subfamilia: null,
        marca: null,
        modelo: null,
      },
    };
    return HttpResponse.json(activo, { status: 201 });
  }),

  // DOC-019 4 — solo para verificación manual en el navegador, no ejercitado por el e2e existente.
  http.get(`${CIS_URL}/dashboard/cobertura`, () =>
    HttpResponse.json({
      activosRegistrados: 3,
      activosEscaneados: 1,
      porcentajeCobertura: 0.333,
      ...MOCK_SYNC,
    }),
  ),
  http.get(`${CIS_URL}/dashboard/areas`, () =>
    HttpResponse.json({
      areas: [
        {
          areaId: 'area-informatica',
          controladaEnPeriodo: true,
          ultimaSesionEn: '2026-08-18T09:00:00.000Z',
        },
        {
          areaId: 'area-biblioteca',
          controladaEnPeriodo: false,
          ultimaSesionEn: null,
        },
      ],
      ...MOCK_SYNC,
    }),
  ),
  http.get(`${CIS_URL}/dashboard/sesiones`, () =>
    HttpResponse.json({
      items: [
        {
          sesionId: 'sesion-1',
          areaId: 'area-informatica',
          veredicto: 'exitoso',
          fechaCierre: '2026-08-18T09:00:00.000Z',
        },
      ],
      total: 1,
      ...MOCK_SYNC,
    }),
  ),
  http.get(`${CIS_URL}/dashboard/fuera-de-area`, () =>
    HttpResponse.json({ items: [], total: 0, ...MOCK_SYNC }),
  ),
  http.get(`${CIS_URL}/dashboard/no-localizados`, () =>
    HttpResponse.json({ items: [], total: 0, ...MOCK_SYNC }),
  ),
  http.get(`${CIS_URL}/dashboard/incidencias`, () =>
    HttpResponse.json({ items: [], total: 0, ...MOCK_SYNC }),
  ),
  http.get(`${CIS_URL}/dashboard/estado-activos`, () =>
    HttpResponse.json({
      estados: [
        { estado: 'activo', cantidad: 3 },
        { estado: 'mantenimiento', cantidad: 1 },
      ],
      ...MOCK_SYNC,
    }),
  ),
  http.get(`${CIS_URL}/dashboard/categorias`, () =>
    HttpResponse.json({
      categorias: [
        { areaId: 'area-informatica', familia: 'Informática', cantidad: 2 },
        { areaId: 'area-informatica', familia: 'Mobiliario', cantidad: 1 },
      ],
      ...MOCK_SYNC,
    }),
  ),
];
