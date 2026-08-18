// Cliente HTTP hacia CIS — web_admin nunca le habla a CORE directo (regla no negociable de
// CLAUDE.md). Solo el subconjunto de endpoints de Administrador del Sistema (organizaciones,
// contratos, usuarios, indicadores) — Activo/Catálogo/Documentos/Áreas/Ubicaciones/Responsables/
// Auditoría/Inventarios son de `ccp/`, ese rol nunca toca información patrimonial (DOC-021 1,
// DOC-022 2).
import { loadOidcConfig } from './oidc/oidc-config';
import { oidcClient, AuthenticationRequiredError } from './oidc/oidc-client';

export interface Sede {
  id: string;
  nombre: string;
}

// DOC-021 4 (Administrador del Sistema).
export interface OrganizacionAdmin {
  id: string;
  nombre: string;
}

export interface AltaOrganizacionInput {
  id: string;
  nombre: string;
}

export interface ContratosPorEstado {
  vigente: number;
  suspendido: number;
  vencido: number;
  cancelado: number;
}

export interface Indicadores {
  totalOrganizaciones: number;
  totalSedes: number;
  contratosPorEstado: ContratosPorEstado;
}

export interface UsuarioOrganizacion {
  userId: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
}

export type RolAsignable = 'administrador-patrimonial' | 'directivo' | 'administrador-sistema';

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

export class CisApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CisApiError';
  }
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
  // DOC-021 4 (Administrador del Sistema) — lectura abierta, ve TODAS las organizaciones
  // (incluidas las sin contrato vigente).
  async getOrganizaciones(): Promise<OrganizacionAdmin[]> {
    const res = await authorizedFetch('/admin/organizaciones');
    return (await res.json()) as OrganizacionAdmin[];
  },

  async altaOrganizacion(input: AltaOrganizacionInput): Promise<OrganizacionAdmin> {
    const res = await authorizedFetch('/admin/organizaciones', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return (await res.json()) as OrganizacionAdmin;
  },

  async getIndicadores(): Promise<Indicadores> {
    const res = await authorizedFetch('/admin/indicadores');
    return (await res.json()) as Indicadores;
  },

  async getUsuariosOrganizacion(orgId: string): Promise<UsuarioOrganizacion[]> {
    const res = await authorizedFetch(
      `/admin/organizaciones/${encodeURIComponent(orgId)}/usuarios`,
    );
    return (await res.json()) as UsuarioOrganizacion[];
  },

  async asignarUsuarioOrganizacion(
    orgId: string,
    email: string,
    rol: RolAsignable,
  ): Promise<void> {
    await authorizedFetch(`/admin/organizaciones/${encodeURIComponent(orgId)}/usuarios`, {
      method: 'POST',
      body: JSON.stringify({ email, rol }),
    });
  },

  // RNF-01 — CIS/CORE paginan (`{ contratos, total }`, default 20/tope 100). Sin UI de
  // paginación (fuera de alcance, ningún RF la pide) — pide el tope de página (100) para no
  // perder filas silenciosamente mientras el volumen de datos se mantenga bajo esa cota.
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
};

export { AuthenticationRequiredError };
