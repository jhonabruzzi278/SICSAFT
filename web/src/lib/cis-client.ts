// Cliente HTTP hacia CIS — WEB nunca le habla a CORE directo (regla no negociable de CLAUDE.md).
// Reusa DOC-006 (GET /catalogo, POST /auth/session) igual que app-qr-sicsaft (WAF §8, "WEB y APP
// QR son clientes intercambiables del mismo contrato") + el endpoint nuevo de Fase 5
// (POST /admin/activos, DOC-012 §5).
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
  catalogo: {
    tipo: string;
    familia: string;
    subfamilia: string | null;
    marca: string | null;
    modelo: string | null;
  };
}

// DOC-004 §3 — maquina de estados de Contrato: solo estas transiciones son validas, CORE rechaza
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
// justifica deviceId para APP QR (DOC-002 §1), pero POST /auth/session lo exige igual (mismo
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

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
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
    throw new CisApiError(res.status, body.message ?? `CIS devolvió ${res.status}`);
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

  async getContratos(): Promise<Contrato[]> {
    const res = await authorizedFetch('/admin/contratos');
    return (await res.json()) as Contrato[];
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
    const res = await authorizedFetch(`/admin/contratos/${encodeURIComponent(contratoId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ organizacionId, estado }),
    });
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
};

export { AuthenticationRequiredError };
