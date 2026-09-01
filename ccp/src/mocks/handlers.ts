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
import {
  MOCK_AREAS,
  MOCK_CATALOGO,
  MOCK_ORGANIZACIONES,
  MOCK_SYNC,
} from './fixtures';

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

  // DOC-029 RF-F — el módulo QR / Etiquetas agrupa el catálogo por `area.dependencia`.
  http.get(`${CIS_URL}/admin/areas`, ({ request }) => {
    const organizacionId = new URL(request.url).searchParams.get(
      'organizacionId',
    );
    const areas = MOCK_AREAS.filter((a) => a.organizacionId === organizacionId);
    return HttpResponse.json({ areas, total: areas.length });
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
        {
          sesionId: 'sesion-2',
          areaId: 'area-biblioteca',
          veredicto: 'defectuoso',
          fechaCierre: '2026-08-19T14:30:00.000Z',
        },
      ],
      total: 2,
      ...MOCK_SYNC,
    }),
  ),

  // DOC-029 RF-I — informe de control de área ("Pantalla 8") por sesión.
  http.get(`${CIS_URL}/inventarios/:id/control`, ({ params }) => {
    const id = params.id as string;
    const base = {
      sesionId: id,
      organizacionId: 'duoc-uc',
      ubicacionId: 'ubicacion-lab-1',
      operadorId: 'op-aft-1',
      fechaInicio: '2026-08-18T08:30:00.000Z',
      estado: 'recibido' as const,
    };
    if (id === 'sesion-2') {
      return HttpResponse.json({
        ...base,
        areaId: 'area-biblioteca',
        fechaCierre: '2026-08-19T14:30:00.000Z',
        escaneados: 2,
        delArea: 1,
        activosDelArea: 3,
        delAreaPct: 1 / 3,
        porEstadoDeclarado: {
          enServicio: 1,
          enMantenimiento: 0,
          inactivo: 0,
          baja: 1,
        },
        escaneadosLista: [
          {
            codigoQr: 'QR-ESCANER-003',
            nombre: 'Escáner de libros Plustek',
            tipo: 'ordinario',
            resultado: 'correcto',
          },
          {
            codigoQr: 'QR-NOTEBOOK-001',
            nombre: 'Notebook Dell Latitude',
            tipo: 'ordinario',
            resultado: 'otra_area',
          },
        ],
        fueraDeArea: [
          {
            codigoQr: 'QR-NOTEBOOK-001',
            nombre: 'Notebook Dell Latitude',
            tipo: 'ordinario',
            areaRealNombre: 'Informática',
          },
        ],
        faltantes: [
          { codigoQr: 'QR-LIBRO-010', nombre: 'Colección enciclopédica' },
          { codigoQr: 'QR-SILLA-021', nombre: 'Silla de lectura' },
        ],
        veredicto: 'defectuoso' as const,
      });
    }
    return HttpResponse.json({
      ...base,
      areaId: 'area-informatica',
      fechaCierre: '2026-08-18T09:00:00.000Z',
      escaneados: 2,
      delArea: 2,
      activosDelArea: 2,
      delAreaPct: 1,
      porEstadoDeclarado: {
        enServicio: 1,
        enMantenimiento: 1,
        inactivo: 0,
        baja: 0,
      },
      escaneadosLista: [
        {
          codigoQr: 'QR-NOTEBOOK-001',
          nombre: 'Notebook Dell Latitude',
          tipo: 'ordinario',
          resultado: 'correcto',
        },
        {
          codigoQr: 'QR-PROYECTOR-002',
          nombre: 'Proyector Epson PowerLite',
          tipo: 'ordinario',
          resultado: 'correcto',
        },
      ],
      fueraDeArea: [],
      faltantes: [],
      veredicto: 'exitoso' as const,
    });
  }),
  // DOC-029 RF-E — auditoría con área operativa + filtro parcial por `area`.
  http.get(`${CIS_URL}/admin/auditoria`, ({ request }) => {
    const area = new URL(request.url).searchParams.get('area');
    const todas = [
      {
        id: 'audit-1',
        usuario: 'aft@melipilla.cl',
        fecha: '2026-08-19T14:35:00.000Z',
        equipo: 'PC-AFT-01',
        ip: '192.168.1.42',
        operacion: 'POST /inventarios',
        resultado: 'recibido',
        observaciones: null,
        areaOperativa: 'area-biblioteca',
      },
      {
        id: 'audit-2',
        usuario: 'aft@melipilla.cl',
        fecha: '2026-08-18T09:10:00.000Z',
        equipo: null,
        ip: null,
        operacion: 'POST /activos/DG-001/baja',
        resultado: 'ok',
        observaciones: 'faltante tras el control',
        areaOperativa: null,
      },
    ];
    const entradas = area
      ? todas.filter((e) =>
          (e.areaOperativa ?? '').toLowerCase().includes(area.toLowerCase()),
        )
      : todas;
    return HttpResponse.json({ entradas, total: entradas.length });
  }),

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
