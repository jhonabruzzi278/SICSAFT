// DOC-019 4.2 — cliente hacia el módulo Dashboard de CIS (proxy hacia CIP, mismo criterio que
// dashboard-connector.controller.ts). El portal del Directivo nunca le habla a CIP directo
// (DOC-019 3) ni al backend de CORE directo (ADR-003).
import { loadOidcConfig } from './oidc/oidc-config';
import { oidcClient } from './oidc/oidc-client';
import { CisApiError } from './cis-client';

export interface SyncInfo {
  actualizadoEn: string | null;
  alDia: boolean;
}

export interface Cobertura extends SyncInfo {
  activosRegistrados: number;
  activosEscaneados: number;
  porcentajeCobertura: number;
}

export interface ControlArea {
  areaId: string;
  controladaEnPeriodo: boolean;
  ultimaSesionEn: string | null;
}

export interface VeredictoSesion {
  sesionId: string;
  areaId: string;
  veredicto: string;
  fechaCierre: string;
  revisado: boolean;
  revisadoPor: string | null;
  revisadoEn: string | null;
}

// DOC-034 Parte A — sesionId/veredicto agregados para entrelazar la alerta con el reporte
// (sesión de control) que la generó.
export interface ActivoFueraDeArea {
  codigoQr: string;
  sesionId: string;
  areaRealId: string;
  areaEsperadaId: string;
  veredicto: string;
  detectadoEn: string;
}

// DOC-034 Parte B — un corte diario del historial (resumen_diario).
export interface ResumenDiario {
  fecha: string;
  totalSesiones: number;
  exitoso: number;
  aceptable: number;
  defectuoso: number;
}

export interface ActivoNoLocalizado {
  codigoQr: string;
  desdeEn: string;
}

export interface Incidencia {
  sesionId: string;
  codigoQr: string;
  observaciones: string;
  fecha: string;
}

export interface EstadoResumen {
  estado: string;
  cantidad: number;
}

export interface CategoriaResumen {
  areaId: string;
  familia: string;
  cantidad: number;
}

export interface VeredictoResumen {
  veredicto: string;
  cantidad: number;
}

export interface VentanaVeredictos {
  total: number;
  porVeredicto: VeredictoResumen[];
}

export interface ResumenVeredictos extends SyncInfo {
  dia: VentanaVeredictos;
  acumulado: VentanaVeredictos;
}

interface Pagina<T> {
  items: T[];
  total: number;
}

async function authorizedFetch(
  path: string,
  params: Record<string, string>,
): Promise<Response> {
  const config = loadOidcConfig();
  const accessToken = await oidcClient.getValidAccessToken();
  const query = new URLSearchParams(params);
  const res = await fetch(`${config.cisUrl}${path}?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
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

// Notificaciones del organigrama (2026-09-16) — única escritura de este cliente. Sin body: CIS
// deriva revisadoPor del propio JWT (requireAuthContext), nunca lo manda el navegador.
async function authorizedPatch(path: string): Promise<Response> {
  const config = loadOidcConfig();
  const accessToken = await oidcClient.getValidAccessToken();
  const res = await fetch(`${config.cisUrl}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
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

export const dashboardClient = {
  async getCobertura(organizacionId: string): Promise<Cobertura> {
    const res = await authorizedFetch('/dashboard/cobertura', {
      organizacionId,
    });
    return (await res.json()) as Cobertura;
  },

  async getAreas(
    organizacionId: string,
  ): Promise<{ areas: ControlArea[] } & SyncInfo> {
    const res = await authorizedFetch('/dashboard/areas', { organizacionId });
    return (await res.json()) as { areas: ControlArea[] } & SyncInfo;
  },

  async getSesiones(
    organizacionId: string,
    areaId?: string,
    limit = 100,
    offset = 0,
  ): Promise<Pagina<VeredictoSesion> & SyncInfo> {
    const params: Record<string, string> = {
      organizacionId,
      limit: String(limit),
      offset: String(offset),
    };
    if (areaId) params.areaId = areaId;
    const res = await authorizedFetch('/dashboard/sesiones', params);
    return (await res.json()) as Pagina<VeredictoSesion> & SyncInfo;
  },

  // CIP topea a 100 filas por página (paginacionSchema de CIS) — el organigrama y la lista de
  // reportes necesitan el universo completo de sesiones de la organización para contar
  // notificaciones/filtrar por veredicto, no solo una página. Compartido entre
  // OrganigramaControlesArea.tsx y ReportesDeAreaPage.tsx (2026-09-16).
  async getTodasLasSesiones(
    organizacionId: string,
  ): Promise<VeredictoSesion[]> {
    const sesiones: VeredictoSesion[] = [];
    let offset = 0;
    for (;;) {
      const pagina = await this.getSesiones(
        organizacionId,
        undefined,
        100,
        offset,
      );
      sesiones.push(...pagina.items);
      offset += pagina.items.length;
      if (pagina.items.length === 0 || sesiones.length >= pagina.total) break;
    }
    return sesiones;
  },

  async marcarRevisado(sesionId: string): Promise<VeredictoSesion> {
    const res = await authorizedPatch(
      `/dashboard/sesiones/${encodeURIComponent(sesionId)}/revisar`,
    );
    return (await res.json()) as VeredictoSesion;
  },

  async getFueraDeArea(
    organizacionId: string,
    areaId?: string,
  ): Promise<Pagina<ActivoFueraDeArea> & SyncInfo> {
    const params: Record<string, string> = { organizacionId, limit: '100' };
    if (areaId) params.areaId = areaId;
    const res = await authorizedFetch('/dashboard/fuera-de-area', params);
    return (await res.json()) as Pagina<ActivoFueraDeArea> & SyncInfo;
  },

  async getNoLocalizados(
    organizacionId: string,
  ): Promise<Pagina<ActivoNoLocalizado> & SyncInfo> {
    const res = await authorizedFetch('/dashboard/no-localizados', {
      organizacionId,
      limit: '100',
    });
    return (await res.json()) as Pagina<ActivoNoLocalizado> & SyncInfo;
  },

  async getIncidencias(
    organizacionId: string,
    codigoQr?: string,
  ): Promise<Pagina<Incidencia> & SyncInfo> {
    const params: Record<string, string> = { organizacionId, limit: '100' };
    if (codigoQr) params.codigoQr = codigoQr;
    const res = await authorizedFetch('/dashboard/incidencias', params);
    return (await res.json()) as Pagina<Incidencia> & SyncInfo;
  },

  async getEstadoActivos(
    organizacionId: string,
  ): Promise<{ estados: EstadoResumen[] } & SyncInfo> {
    const res = await authorizedFetch('/dashboard/estado-activos', {
      organizacionId,
    });
    return (await res.json()) as { estados: EstadoResumen[] } & SyncInfo;
  },

  async getVeredictos(organizacionId: string): Promise<ResumenVeredictos> {
    const res = await authorizedFetch('/dashboard/veredictos', {
      organizacionId,
    });
    return (await res.json()) as ResumenVeredictos;
  },

  async getCategorias(
    organizacionId: string,
    areaId?: string,
  ): Promise<{ categorias: CategoriaResumen[] } & SyncInfo> {
    const params: Record<string, string> = { organizacionId };
    if (areaId) params.areaId = areaId;
    const res = await authorizedFetch('/dashboard/categorias', params);
    return (await res.json()) as { categorias: CategoriaResumen[] } & SyncInfo;
  },

  async getHistorico(
    organizacionId: string,
    desde?: string,
    hasta?: string,
  ): Promise<Pagina<ResumenDiario> & SyncInfo> {
    const params: Record<string, string> = { organizacionId, limit: '100' };
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    const res = await authorizedFetch('/dashboard/historico', params);
    return (await res.json()) as Pagina<ResumenDiario> & SyncInfo;
  },
};
