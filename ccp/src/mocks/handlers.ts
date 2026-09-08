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

// Estado mutable propio del catálogo mockeado
let catalogo: ActivoCatalogo[] = [...MOCK_CATALOGO];
const documentosPorActivo = new Map<string, Array<{ id: string; activoId: string; organizacionId: string; tipo: 'documento' | 'fotografia'; url: string; descripcion: string | null; creadoEn: string }>>();

export function resetCatalogo(): void {
  catalogo = [...MOCK_CATALOGO];
  documentosPorActivo.clear();
}

export const defaultHandlers = [
  http.post(`*/auth/session`, () =>
    HttpResponse.json({ organizaciones: MOCK_ORGANIZACIONES }),
  ),

  http.get(`*/catalogo`, ({ request }) => {
    const url = new URL(request.url);
    const organizacionId = url.searchParams.get('organizacionId');
    const activos = catalogo.filter((a) => !organizacionId || a.organizacionId === organizacionId);
    return HttpResponse.json({ activos });
  }),

  http.get(`*/admin/catalogo-tipos`, () =>
    HttpResponse.json(MOCK_CATALOGO_TIPOS),
  ),

  // DOC-029 RF-F — el módulo QR / Etiquetas agrupa el catálogo por `area.dependencia`.
  http.get(`*/admin/areas`, ({ request }) => {
    const organizacionId = new URL(request.url).searchParams.get(
      'organizacionId',
    );
    const areas = MOCK_AREAS.filter((a) => !organizacionId || a.organizacionId === organizacionId);
    return HttpResponse.json({ areas, total: areas.length });
  }),

  http.post(`*/admin/areas`, async ({ request }) => {
    const body = (await request.json()) as { organizacionId: string; codigo: string; nombre: string; dependencia?: string; centroCosto?: string };
    const nuevaArea = {
      id: `area-${crypto.randomUUID().slice(0, 6)}`,
      organizacionId: body.organizacionId,
      codigo: body.codigo,
      nombre: body.nombre,
      dependencia: body.dependencia || null,
      centroCosto: body.centroCosto || null,
      responsableId: null,
      ubicacionPrincipalId: null,
    };
    MOCK_AREAS.push(nuevaArea);
    return HttpResponse.json(nuevaArea, { status: 201 });
  }),

  http.get(`*/admin/responsables`, () => {
    return HttpResponse.json({
      responsables: [],
      total: 0,
    });
  }),

  http.post(`*/admin/responsables`, async ({ request }) => {
    const body = (await request.json()) as { organizacionId: string; nombre: string; identificacion: string; cargo?: string; areaId: string };
    const nuevoResp = {
      id: `resp-${crypto.randomUUID().slice(0, 6)}`,
      ...body,
      cargo: body.cargo || null,
      correo: null,
      telefono: null,
      estado: 'activo' as const,
    };
    return HttpResponse.json(nuevoResp, { status: 201 });
  }),

  http.get(`*/admin/ubicaciones`, () => {
    return HttpResponse.json({
      ubicaciones: [],
      total: 0,
    });
  }),

  http.post(`*/admin/ubicaciones`, async ({ request }) => {
    const body = (await request.json()) as { organizacionId: string; sedeId: string; edificio?: string; piso?: string; oficina?: string };
    const nuevaUbic = {
      id: `ubic-${crypto.randomUUID().slice(0, 6)}`,
      ...body,
      edificio: body.edificio || null,
      piso: body.piso || null,
      areaId: null,
      oficina: body.oficina || null,
      dependencia: null,
    };
    return HttpResponse.json(nuevaUbic, { status: 201 });
  }),

  http.get(`*/admin/contratos`, () => {
    return HttpResponse.json({
      contratos: [],
      total: 0,
    });
  }),

  http.get(`*/inventarios`, () => {
    return HttpResponse.json({
      items: [],
      total: 0,
    });
  }),

  http.get(`*/admin/importaciones/contable/lote`, () => {
    return HttpResponse.json([
      {
        id: 'lote-demo-001',
        organizacionId: 'org-demo',
        origen: 'carpeta',
        archivoNombre: 'CU-PAT-DIRECCION-COMERCIAL-completo.xlsx',
        recibidoEn: new Date().toISOString(),
        estado: 'pendiente_revision',
        revisadoPor: null,
        revisadoEn: null,
        motivoRechazo: null,
        resumen: { totalFilas: 39, crear: 39, yaImportado: 0, conflicto: 0 },
      },
    ]);
  }),

  http.get(`*/admin/importaciones/contable/lote/:id`, ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      lote: {
        id,
        organizacionId: 'org-demo',
        origen: 'carpeta',
        archivoNombre: 'CU-PAT-DIRECCION-COMERCIAL-completo.xlsx',
        recibidoEn: new Date().toISOString(),
        estado: 'pendiente_revision',
        revisadoPor: null,
        revisadoEn: null,
        motivoRechazo: null,
        resumen: { totalFilas: 39, crear: 39, yaImportado: 0, conflicto: 0 },
      },
      filas: [
        {
          id: 'fila-01',
          linea: 1,
          codigoPatrimonial: 'DC-01',
          codigoQr: 'DC-01',
          catalogoId: 'catalogo-climatizacion',
          serie: 'SN-12000BTU',
          responsableId: null,
          areaId: 'area-001',
          ubicacionId: 'loc-001',
          valorPatrimonial: 450000,
          direccionNombre: 'DIRECCIÓN COMERCIAL',
          areaNombre: 'OFICINA DIRECTOR COMERCIAL',
          responsableNombre: null,
          categoriaNombre: 'CLIMATIZACIÓN',
          nombreAft: '1 EQUIPO CLIMATIZACION 12000 BTU',
          crudo: {},
          dryRunResultado: 'crear',
          dryRunMotivo: null,
        },
        {
          id: 'fila-02',
          linea: 2,
          codigoPatrimonial: 'DC-02',
          codigoQr: 'DC-02',
          catalogoId: 'catalogo-sofa',
          serie: null,
          responsableId: null,
          areaId: 'area-001',
          ubicacionId: 'loc-001',
          valorPatrimonial: 280000,
          direccionNombre: 'DIRECCIÓN COMERCIAL',
          areaNombre: 'OFICINA DIRECTOR COMERCIAL',
          responsableNombre: null,
          categoriaNombre: 'MOBILIARIO',
          nombreAft: '1 SOFA 3 PERSONAS',
          crudo: {},
          dryRunResultado: 'crear',
          dryRunMotivo: null,
        },
      ],
    });
  }),

  http.post(`*/admin/importaciones/contable/lote/:id/aprobar`, () => {
    // Al aprobar en mock, incorporamos los 39 activos del lote de prueba a la base
    const baseActivos = [
      { id: 'dc-01', qr: 'DC-01', nombre: '1 EQUIPO CLIMATIZACION 12000 BTU', area: 'OFICINA DIRECTOR COMERCIAL' },
      { id: 'dc-02', qr: 'DC-02', nombre: '1 SOFA 3 PERSONAS', area: 'OFICINA DIRECTOR COMERCIAL' },
      { id: 'dc-03', qr: 'DC-03', nombre: '1 MESA DE CENTRO DE MADERA', area: 'OFICINA DIRECTOR COMERCIAL' },
      { id: 'dc-04', qr: 'DC-04', nombre: '1 ESCRITORIO EN L MADERA 1.60X1.40', area: 'OFICINA DIRECTOR COMERCIAL' },
      { id: 'dc-05', qr: 'DC-05', nombre: '1 SILLON EJECUTIVO ECOCUERO GIRATORIO', area: 'OFICINA DIRECTOR COMERCIAL' },
      { id: 'dc-06', qr: 'DC-06', nombre: '2 SILLAS DE VISITA TAPIZADAS', area: 'OFICINA DIRECTOR COMERCIAL' },
      { id: 'dc-07', qr: 'DC-07', nombre: '1 KARDEX METALICO 4 CAJONES', area: 'OFICINA DIRECTOR COMERCIAL' },
      { id: 'dc-08', qr: 'DC-08', nombre: '1 ESTANTE BIBLIOTECA 5 DIVISIONES', area: 'OFICINA DIRECTOR COMERCIAL' },
    ];
    for (const a of baseActivos) {
      if (!catalogo.some(c => c.codigoQr === a.qr)) {
        catalogo.push({
          id: a.id,
          codigoQr: a.qr,
          nombre: a.nombre,
          organizacionId: 'org-demo',
          areaId: 'area-001',
          areaNombre: a.area,
          ubicacionId: 'loc-001',
          estado: 'activo',
        });
      }
    }
    return HttpResponse.json({
      creados: 39,
      yaImportados: 0,
      conflictos: 0,
      filas: [],
    });
  }),

  http.post(`*/admin/importaciones/contable/lote/:id/rechazar`, () => {
    return new HttpResponse(null, { status: 204 });
  }),


  http.post(`*/admin/importaciones/contable`, async ({ request }) => {
    const body = (await request.json()) as { filas: Array<{ codigoPatrimonial: string }> };
    return HttpResponse.json({
      filas: (body.filas || []).map((f) => ({ codigoPatrimonial: f.codigoPatrimonial, resultado: 'creado' })),
      creados: body.filas?.length || 0,
      yaImportados: 0,
      conflictos: 0,
    });
  }),


  http.post(`*/admin/activos`, async ({ request }) => {
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


  // Endpoints de Documentación, Fotografías y Modificación de Activos
  http.get(`*/admin/activos/:id/documentos`, ({ params }) => {
    const { id } = params;
    const docs = documentosPorActivo.get(String(id)) || [];
    return HttpResponse.json(docs);
  }),

  http.post(`*/admin/activos/:id/documentos`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as {
      organizacionId: string;
      tipo: 'documento' | 'fotografia';
      url: string;
      descripcion?: string;
    };
    const nuevoDoc = {
      id: crypto.randomUUID(),
      activoId: String(id),
      organizacionId: body.organizacionId,
      tipo: body.tipo,
      url: body.url,
      descripcion: body.descripcion || null,
      creadoEn: new Date().toISOString(),
    };
    const lista = documentosPorActivo.get(String(id)) || [];
    lista.push(nuevoDoc);
    documentosPorActivo.set(String(id), lista);
    return HttpResponse.json(nuevoDoc, { status: 201 });
  }),

  http.delete(`*/admin/activos/:id/documentos/:documentoId`, ({ params }) => {
    const { id, documentoId } = params;
    const lista = documentosPorActivo.get(String(id)) || [];
    const filtrada = lista.filter((d) => d.id !== documentoId);
    documentosPorActivo.set(String(id), filtrada);
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch(`*/admin/activos/:id/responsable`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as { responsableId: string };
    const act = catalogo.find((a) => a.id === id || a.codigoQr === id);
    return HttpResponse.json({ id, ...act, responsableId: body.responsableId });
  }),

  http.patch(`*/admin/activos/:id/descripcion`, async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as { descripcion: string | null };
    const act = catalogo.find((a) => a.id === id || a.codigoQr === id);
    return HttpResponse.json({ id, ...act, descripcion: body.descripcion });
  }),

  http.post(`*/admin/activos/:id/baja`, ({ params }) => {
    const { id } = params;
    const act = catalogo.find((a) => a.id === id || a.codigoQr === id);
    if (act) act.estado = 'baja';
    return HttpResponse.json({ id, estado: 'baja' });
  }),

  http.post(`*/admin/activos/:id/reincorporar`, ({ params }) => {
    const { id } = params;
    const act = catalogo.find((a) => a.id === id || a.codigoQr === id);
    if (act) act.estado = 'activo';
    return HttpResponse.json({ id, estado: 'activo' });
  }),

  http.get(`*/dashboard/cobertura`, () => {
    const total = catalogo.length;
    const escaneados = catalogo.filter((a) => a.estado === 'activo').length;
    const pct = total > 0 ? (escaneados / total) : 0;
    return HttpResponse.json({
      activosRegistrados: total,
      activosEscaneados: escaneados,
      porcentajeCobertura: pct,
      ...MOCK_SYNC,
    });
  }),
  http.get(`*/dashboard/areas`, () => {
    const areas = MOCK_AREAS.map((a) => ({
      areaId: a.id,
      controladaEnPeriodo: true,
      ultimaSesionEn: new Date().toISOString(),
    }));
    return HttpResponse.json({
      areas,
      ...MOCK_SYNC,
    });
  }),

  http.get(`*/dashboard/sesiones`, () =>
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
  http.get(`*/inventarios/:id/control`, ({ params }) => {
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
  http.get(`*/admin/auditoria`, ({ request }) => {
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

  http.get(`*/dashboard/fuera-de-area`, () =>
    HttpResponse.json({ items: [], total: 0, ...MOCK_SYNC }),
  ),
  http.get(`*/dashboard/no-localizados`, () =>
    HttpResponse.json({ items: [], total: 0, ...MOCK_SYNC }),
  ),
  http.get(`*/dashboard/incidencias`, () =>
    HttpResponse.json({ items: [], total: 0, ...MOCK_SYNC }),
  ),
  http.get(`*/dashboard/estado-activos`, () =>
    HttpResponse.json({
      estados: [
        { estado: 'activo', cantidad: 3 },
        { estado: 'mantenimiento', cantidad: 1 },
      ],
      ...MOCK_SYNC,
    }),
  ),
  http.get(`*/dashboard/categorias`, () =>
    HttpResponse.json({
      categorias: [
        { areaId: 'area-informatica', familia: 'Informática', cantidad: 2 },
        { areaId: 'area-informatica', familia: 'Mobiliario', cantidad: 1 },
      ],
      ...MOCK_SYNC,
    }),
  ),
];
