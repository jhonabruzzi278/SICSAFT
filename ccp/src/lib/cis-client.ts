// Cliente HTTP hacia CIS — WEB nunca le habla a CORE directo (regla no negociable de CLAUDE.md).
// Reusa DOC-006 (GET /catalogo, POST /auth/session) igual que app-qr-sicsaft (WAF 8, "WEB y APP
// QR son clientes intercambiables del mismo contrato") + el endpoint nuevo de Fase 5
// (POST /admin/activos, DOC-012 5).
import { loadOidcConfig } from './oidc/oidc-config';
import { oidcClient, AuthenticationRequiredError } from './oidc/oidc-client';

export interface Sede {
  id: string;
  nombre: string;
}

export interface Organizacion {
  id: string;
  nombre: string;
  sedes: Sede[];
}

export interface ActivoCatalogo {
  // DOC-021 3 — necesario para ofrecer baja/reincorporación/responsable/descripción por fila.
  id: string;
  codigoQr: string;
  nombre: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  estado: string;
}

export interface AltaActivoInput {
  organizacionId: string;
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId: string;
  serie?: string;
  areaId?: string;
  ubicacionId?: string;
  valorPatrimonial?: number;
  descripcion?: string;
}

export interface Activo {
  id: string;
  codigoPatrimonial: string;
  codigoQr: string;
  organizacionId: string;
  areaId: string | null;
  ubicacionId: string | null;
  responsableId: string | null;
  estado: string;
  // DOC-021 3 (gap "descripciones").
  descripcion: string | null;
  catalogo: {
    tipo: string;
    familia: string;
    subfamilia: string | null;
    marca: string | null;
    modelo: string | null;
  };
}

// DOC-021 4 (gap "familias/categorías") — catalogo_activos (tipos/familias), no ActivoCatalogo
// (listado de activos que consume APP QR).
export interface CatalogoTipoActivo {
  id: string;
  tipo: string;
  familia: string;
  subfamilia: string | null;
  marca: string | null;
  modelo: string | null;
  fabricante: string | null;
  vidaUtilMeses: number | null;
  criticidad: 'baja' | 'media' | 'alta';
  tecnologiaIdentificacion: 'qr' | 'rfid' | 'qr_rfid';
}

export interface AltaCatalogoTipoInput {
  organizacionId: string;
  tipo: string;
  familia: string;
  subfamilia?: string;
  marca?: string;
  modelo?: string;
  fabricante?: string;
  vidaUtilMeses?: number;
  criticidad: 'baja' | 'media' | 'alta';
  tecnologiaIdentificacion: 'qr' | 'rfid' | 'qr_rfid';
}

// DOC-021 3 (gap "documentación y fotografías", versión mínima — url externa, sin bucket/OCR
// propio todavía, ver ROADMAP.md Fase 7).
export interface DocumentoActivo {
  id: string;
  activoId: string;
  organizacionId: string;
  tipo: 'documento' | 'fotografia';
  url: string;
  descripcion: string | null;
  creadoEn: string;
  creadoPor: string;
}

export interface AltaDocumentoActivoInput {
  organizacionId: string;
  tipo: 'documento' | 'fotografia';
  url: string;
  descripcion?: string;
}

// DOC-012 6 (gap "importaciones controladas").
export interface FilaImportacionContable {
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId: string;
  serie?: string;
  responsableId?: string;
  areaId?: string;
  ubicacionId?: string;
  valorPatrimonial?: number;
}

export interface ResultadoImportacionContable {
  filas: Array<
    | { codigoPatrimonial: string; resultado: 'creado' }
    | { codigoPatrimonial: string; resultado: 'ya_importado' }
    | { codigoPatrimonial: string; resultado: 'conflicto'; motivo: string }
  >;
  creados: number;
  yaImportados: number;
  conflictos: number;
}

// DOC-029 RF-B — bandeja de staging de la ingesta de Excel supervisada. El ETL (sidecar Python
// que corre el .exe al detectar un .xls en la carpeta vigilada) postea el lote a CIS; CORE lo
// guarda en `pendiente_revision` sin tocar la Base Patrimonial, y el Profesional de AFT lo
// aprueba o rechaza desde esta pantalla. Los tipos reflejan
// cis/src/core-client/core-client.types.ts (loteImportacionContableSchema y filas).
export type EstadoLoteImportacion =
  'pendiente_revision' | 'aprobado' | 'rechazado';

export interface ResumenLoteImportacion {
  totalFilas: number;
  crear: number;
  yaImportado: number;
  conflicto: number;
}

export interface LoteImportacionContable {
  id: string;
  organizacionId: string;
  origen: 'carpeta' | 'manual';
  archivoNombre: string | null;
  recibidoEn: string;
  estado: EstadoLoteImportacion;
  revisadoPor: string | null;
  revisadoEn: string | null;
  motivoRechazo: string | null;
  resumen: ResumenLoteImportacion;
}

export type DryRunResultado = 'crear' | 'ya_importado' | 'conflicto';

export interface FilaLoteImportacionContable {
  id: string;
  linea: number;
  codigoPatrimonial: string;
  codigoQr: string;
  catalogoId: string | null;
  serie: string | null;
  responsableId: string | null;
  areaId: string | null;
  ubicacionId: string | null;
  valorPatrimonial: number | null;
  direccionNombre: string | null;
  areaNombre: string | null;
  responsableNombre: string | null;
  categoriaNombre: string | null;
  nombreAft: string | null;
  crudo: Record<string, string>;
  dryRunResultado: DryRunResultado | null;
  dryRunMotivo: string | null;
}

export interface LoteConFilasImportacionContable {
  lote: LoteImportacionContable;
  filas: FilaLoteImportacionContable[];
}

// DOC-004 3 — maquina de estados de Contrato: solo estas transiciones son validas, CORE rechaza
// cualquier otra con 400 (ver core/src/entitlements/contrato.repository.ts,
// TRANSICIONES_VALIDAS). Se repite acá solo para que la UI ofrezca botones con sentido, la
// validacion real vuelve a correr en CORE.
export const TRANSICIONES_VALIDAS_CONTRATO: Record<string, string[]> = {
  vigente: ['suspendido', 'vencido', 'cancelado'],
  suspendido: ['vigente'],
  vencido: [],
  cancelado: [],
};

export interface Contrato {
  id: string;
  organizacionId: string;
  organizacionNombre: string;
  sedes: Sede[];
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  estado: string;
  modulosContratados: string[];
}

export interface AltaContratoInput {
  organizacionId: string;
  sedeIds: string[];
  vigenciaDesde: string;
  vigenciaHasta?: string | null;
  modulosContratados: string[];
}

export interface SesionInventario {
  id: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  operadorId: string;
  fechaInicio: string;
  fechaCierre: string;
  estado: string;
  creadoEn: string;
}

export interface EscaneoInventario {
  codigoQr: string;
  resultado: string;
  observaciones: string | null;
}

export interface SesionInventarioDetalle extends SesionInventario {
  escaneos: EscaneoInventario[];
}

// DOC-029 RF-I — informe de control de área de una sesión ("Pantalla 8"). Passthrough del
// contrato de CORE vía CIS (GET /inventarios/:id/control); refleja
// cis/src/qr-connector/qr-connector.types.ts ResumenControl.
export type TipoControlAft = 'ordinario' | 'extraordinario';
export type VeredictoControl = 'exitoso' | 'aceptable' | 'defectuoso';

export interface EscaneoControlAft {
  codigoQr: string;
  nombre: string | null;
  tipo: TipoControlAft | null;
  resultado: string;
}

export interface FueraDeAreaControlAft {
  codigoQr: string;
  nombre: string | null;
  tipo: TipoControlAft | null;
  areaRealNombre: string | null;
}

export interface FaltanteControlAft {
  codigoQr: string;
  nombre: string;
}

export interface ResumenControlArea {
  sesionId: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  operadorId: string;
  fechaInicio: string;
  fechaCierre: string;
  estado: string;
  escaneados: number;
  delArea: number;
  activosDelArea: number;
  delAreaPct: number;
  porEstadoDeclarado: {
    enServicio: number;
    enMantenimiento: number;
    inactivo: number;
    baja: number;
  };
  escaneadosLista: EscaneoControlAft[];
  fueraDeArea: FueraDeAreaControlAft[];
  faltantes: FaltanteControlAft[];
  veredicto: VeredictoControl;
}

// RF-06 — sin organizacionId (ver core/src/auditoria/auditoria.types.ts): la tabla audita
// cualquier operacion del ecosistema, no solo las de una organizacion.
export interface AuditoriaEntrada {
  id: string;
  usuario: string;
  fecha: string;
  equipo: string | null;
  ip: string | null;
  operacion: string;
  resultado: string;
  observaciones: string | null;
  // DOC-029 RF-E — área operativa del actor (null si la operación no es sobre un área concreta).
  areaOperativa: string | null;
}

// RF-06 — filtros de GET /admin/auditoria (cierra el gap: el requisito pedia "filtrable por
// usuario/fecha/operacion"). `usuario`/`operacion` son busqueda parcial (ver
// core/src/auditoria/auditoria.types.ts), `fechaDesde`/`fechaHasta` son inputs `datetime-local`
// del navegador — se envian tal cual, CORE los usa directo en un `fecha >= $n`/`fecha <= $n`.
export interface AuditoriaFiltro {
  usuario?: string;
  operacion?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  // DOC-029 RF-E — filtro parcial por área operativa (lo usa el deep-link de RF-D §D.2).
  area?: string;
}

// RF-05 — Area/Ubicacion/Responsable (DOC-005 2/3).
export interface Area {
  id: string;
  organizacionId: string;
  codigo: string;
  nombre: string;
  dependencia: string | null;
  centroCosto: string | null;
  responsableId: string | null;
  ubicacionPrincipalId: string | null;
}

export interface AltaAreaInput {
  organizacionId: string;
  codigo: string;
  nombre: string;
  dependencia?: string;
  centroCosto?: string;
}

// RF-05 (cierra el gap "ABM completo") — PATCH /admin/areas/:id, todos opcionales pero CIS/CORE
// exigen al menos uno.
export interface ActualizarAreaInput {
  organizacionId: string;
  codigo?: string;
  nombre?: string;
  dependencia?: string;
  centroCosto?: string;
  responsableId?: string;
  ubicacionPrincipalId?: string;
}

export interface Ubicacion {
  id: string;
  sedeId: string;
  edificio: string | null;
  piso: string | null;
  areaId: string | null;
  oficina: string | null;
  dependencia: string | null;
}

export interface AltaUbicacionInput {
  organizacionId: string;
  sedeId: string;
  edificio?: string;
  piso?: string;
  areaId?: string;
  oficina?: string;
  dependencia?: string;
}

// RF-05 (cierra el gap "ABM completo") — PATCH /admin/ubicaciones/:id. Sin sedeId (mover de sede
// es un traslado, fuera de alcance).
export interface ActualizarUbicacionInput {
  organizacionId: string;
  edificio?: string;
  piso?: string;
  areaId?: string;
  oficina?: string;
  dependencia?: string;
}

export type EstadoResponsable = 'activo' | 'inactivo';

export interface Responsable {
  id: string;
  identificacion: string;
  nombre: string;
  cargo: string | null;
  areaId: string;
  correo: string | null;
  telefono: string | null;
  estado: EstadoResponsable;
}

export interface AltaResponsableInput {
  organizacionId: string;
  identificacion: string;
  nombre: string;
  cargo?: string;
  areaId: string;
  correo?: string;
  telefono?: string;
}

export class CisApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CisApiError';
  }
}

// Un solo deviceId estable por navegador — WEB no tiene el concepto de "un solo dispositivo" que
// justifica deviceId para APP QR (DOC-002 1), pero POST /auth/session lo exige igual (mismo
// contrato). No se persiste como secreto, solo identifica el "dispositivo" ante el enforcement de
// device-registry de CIS.
const DEVICE_ID_KEY = 'web-sicsaft-device-id';
function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `web-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

async function authorizedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const config = loadOidcConfig();
  const accessToken = await oidcClient.getValidAccessToken();
  const res = await fetch(`${config.cisUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new CisApiError(
      res.status,
      body.message ?? `CIS devolvió ${res.status}`,
    );
  }
  return res;
}

export const cisClient = {
  // POST /auth/session — unica forma hoy de obtener `organizaciones` (GET /entitlements vive
  // detras de CORE, sin ruta directa para un navegador).
  async authSession(): Promise<{ organizaciones: Organizacion[] }> {
    const res = await authorizedFetch('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId() }),
    });
    return (await res.json()) as { organizaciones: Organizacion[] };
  },

  async getCatalogo(organizacionId: string): Promise<ActivoCatalogo[]> {
    const params = new URLSearchParams({ organizacionId });
    const res = await authorizedFetch(`/catalogo?${params.toString()}`);
    const data = (await res.json()) as { activos: ActivoCatalogo[] };
    return data.activos;
  },

  async altaActivo(input: AltaActivoInput): Promise<Activo> {
    const res = await authorizedFetch('/admin/activos', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return (await res.json()) as Activo;
  },

  // DOC-021 3 (gap "estados").
  async bajaActivo(id: string, organizacionId: string): Promise<Activo> {
    const res = await authorizedFetch(
      `/admin/activos/${encodeURIComponent(id)}/baja`,
      {
        method: 'POST',
        body: JSON.stringify({ organizacionId }),
      },
    );
    return (await res.json()) as Activo;
  },

  async reincorporarActivo(
    id: string,
    organizacionId: string,
  ): Promise<Activo> {
    const res = await authorizedFetch(
      `/admin/activos/${encodeURIComponent(id)}/reincorporacion`,
      { method: 'POST', body: JSON.stringify({ organizacionId }) },
    );
    return (await res.json()) as Activo;
  },

  async cambiarResponsableActivo(
    id: string,
    organizacionId: string,
    responsableId: string,
  ): Promise<Activo> {
    const res = await authorizedFetch(
      `/admin/activos/${encodeURIComponent(id)}/responsable`,
      {
        method: 'PATCH',
        body: JSON.stringify({ organizacionId, responsableId }),
      },
    );
    return (await res.json()) as Activo;
  },

  // DOC-021 3 (gap "descripciones") — `descripcion: null` limpia el campo.
  async actualizarDescripcionActivo(
    id: string,
    organizacionId: string,
    descripcion: string | null,
  ): Promise<Activo> {
    const res = await authorizedFetch(
      `/admin/activos/${encodeURIComponent(id)}/descripcion`,
      {
        method: 'PATCH',
        body: JSON.stringify({ organizacionId, descripcion }),
      },
    );
    return (await res.json()) as Activo;
  },

  // DOC-021 4 (gap "familias/categorías") — lectura abierta.
  async getCatalogoTipos(): Promise<CatalogoTipoActivo[]> {
    const res = await authorizedFetch('/admin/catalogo-tipos');
    return (await res.json()) as CatalogoTipoActivo[];
  },

  async altaCatalogoTipo(
    input: AltaCatalogoTipoInput,
  ): Promise<CatalogoTipoActivo> {
    const res = await authorizedFetch('/admin/catalogo-tipos', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return (await res.json()) as CatalogoTipoActivo;
  },

  // DOC-021 3 (gap "documentación y fotografías").
  async getDocumentosActivo(
    activoId: string,
    organizacionId: string,
  ): Promise<DocumentoActivo[]> {
    const params = new URLSearchParams({ organizacionId });
    const res = await authorizedFetch(
      `/admin/activos/${encodeURIComponent(activoId)}/documentos?${params.toString()}`,
    );
    return (await res.json()) as DocumentoActivo[];
  },

  async altaDocumentoActivo(
    activoId: string,
    input: AltaDocumentoActivoInput,
  ): Promise<DocumentoActivo> {
    const res = await authorizedFetch(
      `/admin/activos/${encodeURIComponent(activoId)}/documentos`,
      { method: 'POST', body: JSON.stringify(input) },
    );
    return (await res.json()) as DocumentoActivo;
  },

  async eliminarDocumentoActivo(
    activoId: string,
    documentoId: string,
    organizacionId: string,
  ): Promise<void> {
    await authorizedFetch(
      `/admin/activos/${encodeURIComponent(activoId)}/documentos/${encodeURIComponent(documentoId)}`,
      { method: 'DELETE', body: JSON.stringify({ organizacionId }) },
    );
  },

  // DOC-012 6 (gap "importaciones controladas").
  async importarContable(
    organizacionId: string,
    filas: FilaImportacionContable[],
  ): Promise<ResultadoImportacionContable> {
    const res = await authorizedFetch('/admin/importaciones/contable', {
      method: 'POST',
      body: JSON.stringify({ organizacionId, filas }),
    });
    return (await res.json()) as ResultadoImportacionContable;
  },

  // DOC-029 RF-B — bandeja de staging. El ETL crea los lotes (POST .../lote); la UI solo lista,
  // revisa y aprueba/rechaza. La aprobación va con el JWT real del Profesional de AFT — CORE
  // re-verifica el rol y audita bajo su identidad, no la sintética de la ingesta.
  async listarLotesImportacionContable(
    organizacionId: string,
    estado?: EstadoLoteImportacion,
  ): Promise<LoteImportacionContable[]> {
    const params = new URLSearchParams({ organizacionId });
    if (estado) params.set('estado', estado);
    const res = await authorizedFetch(
      `/admin/importaciones/contable/lote?${params.toString()}`,
    );
    return (await res.json()) as LoteImportacionContable[];
  },

  async obtenerLoteImportacionContable(
    id: string,
  ): Promise<LoteConFilasImportacionContable> {
    const res = await authorizedFetch(
      `/admin/importaciones/contable/lote/${encodeURIComponent(id)}`,
    );
    return (await res.json()) as LoteConFilasImportacionContable;
  },

  async aprobarLoteImportacionContable(
    id: string,
    organizacionId: string,
  ): Promise<ResultadoImportacionContable> {
    const res = await authorizedFetch(
      `/admin/importaciones/contable/lote/${encodeURIComponent(id)}/aprobar`,
      { method: 'POST', body: JSON.stringify({ organizacionId }) },
    );
    return (await res.json()) as ResultadoImportacionContable;
  },

  async rechazarLoteImportacionContable(
    id: string,
    organizacionId: string,
    motivo?: string,
  ): Promise<void> {
    await authorizedFetch(
      `/admin/importaciones/contable/lote/${encodeURIComponent(id)}/rechazar`,
      {
        method: 'POST',
        body: JSON.stringify(
          motivo ? { organizacionId, motivo } : { organizacionId },
        ),
      },
    );
  },

  // RNF-01 — CIS/CORE paginan (`{ contratos, total }`, default 20/tope 100). WEB no tiene UI de
  // paginacion (fuera de alcance, ningun RF la pide) — pide el tope de pagina (100) para no perder
  // filas silenciosamente mientras el volumen de datos se mantenga bajo esa cota.
  async getContratos(): Promise<Contrato[]> {
    const params = new URLSearchParams({ limit: '100' });
    const res = await authorizedFetch(`/admin/contratos?${params.toString()}`);
    const data = (await res.json()) as { contratos: Contrato[]; total: number };
    return data.contratos;
  },

  async altaContrato(input: AltaContratoInput): Promise<Contrato> {
    const res = await authorizedFetch('/admin/contratos', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return (await res.json()) as Contrato;
  },

  async actualizarEstadoContrato(
    contratoId: string,
    organizacionId: string,
    estado: string,
  ): Promise<Contrato> {
    const res = await authorizedFetch(
      `/admin/contratos/${encodeURIComponent(contratoId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ organizacionId, estado }),
      },
    );
    return (await res.json()) as Contrato;
  },

  async getInventarios(organizacionId: string): Promise<SesionInventario[]> {
    const params = new URLSearchParams({ organizacionId });
    const res = await authorizedFetch(`/inventarios?${params.toString()}`);
    return (await res.json()) as SesionInventario[];
  },

  async getInventarioDetalle(id: string): Promise<SesionInventarioDetalle> {
    const res = await authorizedFetch(`/inventarios/${encodeURIComponent(id)}`);
    return (await res.json()) as SesionInventarioDetalle;
  },

  // DOC-029 RF-I — informe de control de área de una sesión ("Pantalla 8"), vía el puente de CIS.
  async getInventarioResumenControl(id: string): Promise<ResumenControlArea> {
    const res = await authorizedFetch(
      `/inventarios/${encodeURIComponent(id)}/control`,
    );
    return (await res.json()) as ResumenControlArea;
  },

  // RNF-01 — mismo criterio que getContratos: sin UI de paginacion, pide el tope de pagina.
  async getAuditoria(filtro: AuditoriaFiltro): Promise<AuditoriaEntrada[]> {
    const params = new URLSearchParams({ limit: '100' });
    if (filtro.usuario) params.set('usuario', filtro.usuario);
    if (filtro.operacion) params.set('operacion', filtro.operacion);
    if (filtro.fechaDesde) params.set('fechaDesde', filtro.fechaDesde);
    if (filtro.fechaHasta) params.set('fechaHasta', filtro.fechaHasta);
    if (filtro.area) params.set('area', filtro.area);
    const res = await authorizedFetch(`/admin/auditoria?${params.toString()}`);
    const data = (await res.json()) as {
      entradas: AuditoriaEntrada[];
      total: number;
    };
    return data.entradas;
  },

  // RNF-01 — mismo criterio que getContratos: sin UI de paginacion, pide el tope de pagina.
  async getAreas(organizacionId: string): Promise<Area[]> {
    const params = new URLSearchParams({ organizacionId, limit: '100' });
    const res = await authorizedFetch(`/admin/areas?${params.toString()}`);
    const data = (await res.json()) as { areas: Area[]; total: number };
    return data.areas;
  },

  async altaArea(input: AltaAreaInput): Promise<Area> {
    const res = await authorizedFetch('/admin/areas', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return (await res.json()) as Area;
  },

  async actualizarArea(id: string, input: ActualizarAreaInput): Promise<Area> {
    const res = await authorizedFetch(
      `/admin/areas/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    );
    return (await res.json()) as Area;
  },

  // RNF-01 — mismo criterio que getContratos: sin UI de paginacion, pide el tope de pagina.
  async getUbicaciones(sedeId: string): Promise<Ubicacion[]> {
    const params = new URLSearchParams({ sedeId, limit: '100' });
    const res = await authorizedFetch(
      `/admin/ubicaciones?${params.toString()}`,
    );
    const data = (await res.json()) as {
      ubicaciones: Ubicacion[];
      total: number;
    };
    return data.ubicaciones;
  },

  async altaUbicacion(input: AltaUbicacionInput): Promise<Ubicacion> {
    const res = await authorizedFetch('/admin/ubicaciones', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return (await res.json()) as Ubicacion;
  },

  async actualizarUbicacion(
    id: string,
    input: ActualizarUbicacionInput,
  ): Promise<Ubicacion> {
    const res = await authorizedFetch(
      `/admin/ubicaciones/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
    return (await res.json()) as Ubicacion;
  },

  // RNF-01 — mismo criterio que getContratos: sin UI de paginacion, pide el tope de pagina.
  async getResponsables(areaId: string): Promise<Responsable[]> {
    const params = new URLSearchParams({ areaId, limit: '100' });
    const res = await authorizedFetch(
      `/admin/responsables?${params.toString()}`,
    );
    const data = (await res.json()) as {
      responsables: Responsable[];
      total: number;
    };
    return data.responsables;
  },

  async altaResponsable(input: AltaResponsableInput): Promise<Responsable> {
    const res = await authorizedFetch('/admin/responsables', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return (await res.json()) as Responsable;
  },

  async actualizarEstadoResponsable(
    responsableId: string,
    organizacionId: string,
    estado: EstadoResponsable,
  ): Promise<Responsable> {
    const res = await authorizedFetch(
      `/admin/responsables/${encodeURIComponent(responsableId)}/estado`,
      { method: 'PATCH', body: JSON.stringify({ organizacionId, estado }) },
    );
    return (await res.json()) as Responsable;
  },
};

export { AuthenticationRequiredError };
