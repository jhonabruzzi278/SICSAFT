// Cliente HTTP hacia CIS — el portal del Directivo nunca le habla al backend de CORE directo
// (ADR-003, regla no negociable de CLAUDE.md). Reusa POST /auth/session tal cual (WAF 8, "WEB y
// APP QR son clientes intercambiables del mismo contrato") solo para resolver la organización del
// propio Directivo, y consume el módulo nuevo de DOC-022 3 (`cis/src/directivo/`) para designar
// al Profesional de AFT.
import { loadOidcConfig } from './oidc/oidc-config';
import { oidcClient, AuthenticationRequiredError } from './oidc/oidc-client';

export interface Sede {
  id: string;
  nombre: string;
}

// Forma del catalogo que devuelve CIS (GET /catalogo).
export interface ActivoCatalogo {
  id: string;
  codigoQr: string;
  codigoAft?: string;
  nombre: string;
  familia: string;
  areaId: string;
  areaNombre: string;
  areaDependencia: string | null;
  ubicacionId: string;
  ubicacionNombre: string;
  /** ISO 8601. Cuando el activo entro a la BPI. */
  incorporadoEn: string;
  estado: string;
  // DOC-033 — catálogo enriquecido de CCP, mismo endpoint GET /catalogo (CIS ya los sirve, ver
  // cis/src/core-client/core-client.types.ts activoCatalogoSchema) — faltaban en esta copia local.
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  valorPatrimonial: number | null;
  fechaCompra: string | null;
  responsableNombre: string | null;
}

export interface Organizacion {
  id: string;
  nombre: string;
  sedes: Sede[];
}

// DOC-035 — jerarquía Organización→Dirección→Departamento→Área para el organigrama de Controles
// de área. Copia adaptada de `ccp/src/lib/cis-client.ts` (ccp/ y core/frontend/ son SPAs
// independientes que no comparten código, ver CLAUDE.md) — mismo `GET /admin/areas` de CIS, que ya
// es de lectura abierta (administrador.controller.ts "RF-05 — lectura abierta"), así que el
// Directivo ya puede leerlo con su propio token OIDC.
export interface Area {
  id: string;
  organizacionId: string;
  codigo: string;
  nombre: string;
  dependencia: string | null;
  departamento: string | null;
}

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

// Fase 4 (reestructuracion CCP/CIP) — tipos/métodos de "Controles de área", portados de
// ccp/src/lib/cis-client.ts (misma forma, mismos endpoints GET /inventarios* de CIS — pantalla de
// solo lectura, sin cambios de guard).
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
  estadoDeclarado: 'activo' | 'mantenimiento' | 'inactivo' | null;
  bajaSugeridaMotivo: string | null;
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

// DOC-022 3 — misma forma que GrantUsuario del lado de CIS (cis/src/keycloak-admin/keycloak-admin.types.ts).
export interface UsuarioOrganizacion {
  userId: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
}

// Gap 3 (flujo real Admin->Directivo->Profesional AFT) — misma forma que
// AsignarProfesionalAftResult del lado de CIS (cis/src/directivo/directivo.schemas.ts).
export interface AsignarProfesionalAftResult {
  creado: boolean;
  passwordInicial: string | null;
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

// Un solo deviceId estable por navegador — mismo criterio que ccp/src/lib/cis-client.ts
// (POST /auth/session lo exige por contrato, DOC-002 1, aunque acá no aplica "un solo dispositivo
// por Directivo" como restricción de negocio real).
const DEVICE_ID_KEY = 'core-frontend-sicsaft-device-id';
function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `core-frontend-${crypto.randomUUID()}`;
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

// Tope que acepta CORE por pagina (paginacionSchema). Se pide el maximo para minimizar viajes.
const CATALOGO_PAGINA = 100;

export const cisClient = {
  // POST /auth/session — única forma hoy de resolver la organización del Directivo para el
  // Dashboard (GET /entitlements vive detrás de CORE, sin ruta directa para un navegador; ver
  // core/README.md "TODO(DOC-004 7)" para la limitación conocida de que hoy no filtra por
  // operador — la misma que ya tenía ccp/HubPage.tsx para este mismo propósito).
  async authSession(): Promise<{ organizaciones: Organizacion[] }> {
    const res = await authorizedFetch('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getDeviceId() }),
    });
    return (await res.json()) as { organizaciones: Organizacion[] };
  },

  // GET /catalogo — el tablero lo necesita para dos cosas que hasta 2026-09-09 eran datos de
  // demo: la tabla de ultimas incorporaciones (un array `ACTIVOS_DEMO` hardcodeado) y el nombre
  // de las areas del control de relevamiento (que mostraba el UUID crudo, porque la proyeccion
  // del CIP solo trae `areaId`). El endpoint es paginado (default 20, tope 100), asi que se
  // recorren las paginas guiandose por el `total`.
  async getCatalogo(organizacionId: string): Promise<ActivoCatalogo[]> {
    const activos: ActivoCatalogo[] = [];
    let total = 0;
    do {
      const params = new URLSearchParams({
        organizacionId,
        limit: String(CATALOGO_PAGINA),
        offset: String(activos.length),
      });
      const res = await authorizedFetch(`/catalogo?${params.toString()}`);
      const data = (await res.json()) as {
        activos: ActivoCatalogo[];
        total: number;
      };
      total = data.total;
      // Corta tambien con pagina vacia: si `total` viniera desalineado, el bucle termina igual.
      if (data.activos.length === 0) break;
      activos.push(...data.activos);
    } while (activos.length < total);
    return activos;
  },

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

  // DOC-035 — mismo endpoint que ccp/src/lib/cis-client.ts getAreas(): lectura abierta, tope de
  // página (RNF-01), sin paginación en la UI porque el organigrama necesita el árbol completo.
  async getAreas(organizacionId: string): Promise<Area[]> {
    const params = new URLSearchParams({ organizacionId, limit: '100' });
    const res = await authorizedFetch(`/admin/areas?${params.toString()}`);
    const data = (await res.json()) as { areas: Area[]; total: number };
    return data.areas;
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

  // DOC-022 3 — sin organizacionId como parámetro: DirectivoGuard en CIS lo deriva siempre del
  // propio JWT, nunca de lo que mande este cliente.
  async getUsuariosDirectivo(): Promise<UsuarioOrganizacion[]> {
    const res = await authorizedFetch('/directivo/usuarios');
    return (await res.json()) as UsuarioOrganizacion[];
  },

  async asignarProfesionalAft(
    email: string,
  ): Promise<AsignarProfesionalAftResult> {
    const res = await authorizedFetch('/directivo/usuarios', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    return (await res.json()) as AsignarProfesionalAftResult;
  },
};

export { AuthenticationRequiredError };
