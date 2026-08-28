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

export type EstadoOrganizacion = 'activo' | 'inactivo';

// DOC-021 4 (Administrador del Sistema). DOC-024 1 agrega `estado` — bookkeeping de plataforma,
// sin cascada a Keycloak ni a Contrato.
export interface OrganizacionAdmin {
  id: string;
  nombre: string;
  estado: EstadoOrganizacion;
}

// Gap 1 (flujo real Admin->Directivo->Profesional AFT) — ya no pide el id de Keycloak: CIS crea la
// organización en Keycloak y usa ese id, ver cis/src/administrador/administrador.service.ts.
export interface AltaOrganizacionInput {
  nombre: string;
}

// DOC-024 1 — PATCH /admin/organizaciones/:orgId (editar nombre) y /estado (dar de baja/
// reactivar).
export interface EditarOrganizacionInput {
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

export type RolAsignable =
  'administrador-patrimonial' | 'directivo' | 'administrador-sistema';

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

// DOC-024 2 — PATCH /admin/contratos/:id/condiciones. Endpoint separado del cambio de `estado`
// (Contrato ya tenía uno) — todos opcionales, al menos uno requerido, `vigenciaDesde` no editable.
export interface ActualizarCondicionesContratoInput {
  organizacionId: string;
  sedeIds?: string[];
  vigenciaHasta?: string | null;
  modulosContratados?: string[];
}

// Gap 2 (flujo real Admin->Directivo->Profesional AFT) — sin esto, ninguna organización nueva
// podía tener nunca un Contrato (altaContrato exige sedeIds ya existentes, y no había forma de
// crear una). `SedeCreada` (con organizacionId) es distinto del `Sede` de arriba (nested en
// Contrato, sin organizacionId — no hace falta ahí porque ya está bajo su Contrato).
export interface AltaSedeInput {
  organizacionId: string;
  nombre: string;
}

// DOC-024 1 agrega `estado` — bookkeeping de plataforma, sin cascada a Keycloak ni a Contrato.
export interface SedeCreada {
  id: string;
  organizacionId: string;
  nombre: string;
  estado: EstadoOrganizacion;
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
  // DOC-021 4 (Administrador del Sistema) — lectura abierta, ve TODAS las organizaciones
  // (incluidas las sin contrato vigente).
  async getOrganizaciones(): Promise<OrganizacionAdmin[]> {
    const res = await authorizedFetch('/admin/organizaciones');
    return (await res.json()) as OrganizacionAdmin[];
  },

  async altaOrganizacion(
    input: AltaOrganizacionInput,
  ): Promise<OrganizacionAdmin> {
    const res = await authorizedFetch('/admin/organizaciones', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return (await res.json()) as OrganizacionAdmin;
  },

  // DOC-024 1 — editar nombre.
  async editarOrganizacion(
    orgId: string,
    input: EditarOrganizacionInput,
  ): Promise<OrganizacionAdmin> {
    const res = await authorizedFetch(
      `/admin/organizaciones/${encodeURIComponent(orgId)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
    return (await res.json()) as OrganizacionAdmin;
  },

  // DOC-024 1 — dar de baja/reactivar. Bidireccional, sin cascada a Contrato.
  async actualizarEstadoOrganizacion(
    orgId: string,
    estado: EstadoOrganizacion,
  ): Promise<OrganizacionAdmin> {
    const res = await authorizedFetch(
      `/admin/organizaciones/${encodeURIComponent(orgId)}/estado`,
      { method: 'PATCH', body: JSON.stringify({ estado }) },
    );
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
    await authorizedFetch(
      `/admin/organizaciones/${encodeURIComponent(orgId)}/usuarios`,
      {
        method: 'POST',
        body: JSON.stringify({ email, rol }),
      },
    );
  },

  // DOC-024 — inverso de asignarUsuarioOrganizacion.
  async quitarRolUsuarioOrganizacion(
    orgId: string,
    userId: string,
    rol: RolAsignable,
  ): Promise<void> {
    await authorizedFetch(
      `/admin/organizaciones/${encodeURIComponent(orgId)}/usuarios/${encodeURIComponent(userId)}`,
      { method: 'DELETE', body: JSON.stringify({ rol }) },
    );
  },

  // DOC-024 — dar de baja a un usuario en Keycloak.
  async desactivarUsuarioOrganizacion(
    orgId: string,
    userId: string,
  ): Promise<void> {
    await authorizedFetch(
      `/admin/organizaciones/${encodeURIComponent(orgId)}/usuarios/${encodeURIComponent(userId)}/desactivar`,
      { method: 'POST' },
    );
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

  // DOC-024 2 — editar condiciones (vigencia/módulos/sedes). Endpoint separado del cambio de
  // estado.
  async actualizarCondicionesContrato(
    contratoId: string,
    input: ActualizarCondicionesContratoInput,
  ): Promise<Contrato> {
    const res = await authorizedFetch(
      `/admin/contratos/${encodeURIComponent(contratoId)}/condiciones`,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
    return (await res.json()) as Contrato;
  },

  async altaSede(input: AltaSedeInput): Promise<SedeCreada> {
    const res = await authorizedFetch('/admin/sedes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return (await res.json()) as SedeCreada;
  },

  // DOC-024 1 — el picker que reemplaza copiar/pegar un id a mano en el formulario de Contrato.
  async getSedes(organizacionId: string): Promise<SedeCreada[]> {
    const params = new URLSearchParams({ organizacionId });
    const res = await authorizedFetch(`/admin/sedes?${params.toString()}`);
    return (await res.json()) as SedeCreada[];
  },

  // DOC-024 1 — dar de baja/reactivar. Bidireccional, sin cascada a Contrato.
  async actualizarEstadoSede(
    sedeId: string,
    organizacionId: string,
    estado: EstadoOrganizacion,
  ): Promise<SedeCreada> {
    const res = await authorizedFetch(
      `/admin/sedes/${encodeURIComponent(sedeId)}/estado`,
      { method: 'PATCH', body: JSON.stringify({ organizacionId, estado }) },
    );
    return (await res.json()) as SedeCreada;
  },
};

export { AuthenticationRequiredError };
