// Cliente del Conector QR (DOC-002) — implementación HTTP real contra CIS (TASK-007). Las 4
// preguntas que bloqueaban esta tarea (HANDOFF-APP-QR-SICSAFT.md sección 6) ya tienen respuesta:
// CIS expone exactamente estas 4 rutas (DOC-006), la identidad viene de un access token real de
// Zitadel vía PKCE (ADR-002, oidc-client.ts), `correlationId` de negocio (este payload) convive
// con el header transversal `X-Correlation-Id` que CIS agrega solo, y la idempotencia es
// idéntica a la propuesta acá (misma key + mismo payload = mismo resultado, distinto payload =
// 409).
import type { ProductVariant, ScanSession } from './db';
import { oidcClient, AuthenticationRequiredError } from './oidc/oidc-client';
import { loadOidcConfig } from './oidc/oidc-config';
import { getOrCreateDeviceId } from './device-id';
import type { OrgArea, OrgLocation, Organization } from './organizations-data';

export { AuthenticationRequiredError };

export interface Sede {
  id: string;
  nombre: string;
}

// Forma real de CIS (GET /entitlements vía CoreClientService) — 2 niveles, organización→sede, no
// 3 como el árbol organización→área→ubicación que usa la UI (`Organization`, ver
// organizations-data.ts). CIS/CORE no modelan "área" al nivel de Contrato (base-patrimonial/
// DOC-004) — solo aparece como campo suelto por activo en el catálogo. `buildOrganizationTree`
// de acá abajo arma el árbol completo que la UI espera a partir de eso.
export interface OrganizacionSummary {
  id: string;
  nombre: string;
  sedes: Sede[];
}

export interface ConnectorAsset {
  codigoQr: string;
  nombre: string;
  organizacionId: string;
  areaId: string;
  ubicacionId: string;
  // Extensión no cubierta por DOC-002 todavía: el contrato documentado no
  // modela variantes/talles. Se mantiene para que el escaneo de códigos
  // "BASE-VARIANTE" (ver labels.ts) siga funcionando — CIS no la conoce, se
  // resuelve local contra el catálogo propio (ver CatalogPage.tsx, fuera de
  // alcance de TASK-007).
  variants?: ProductVariant[];
}

export interface AuthSessionResult {
  accessToken: string;
  expiresAt: string;
  organizaciones: OrganizacionSummary[];
}

export interface InventarioResult {
  inventarioId: string;
  estado: 'recibido' | 'rechazado';
  errores?: string[];
}

export interface InventarioEstado {
  estado: 'pendiente' | 'recibido' | 'rechazado';
  ultimoIntento: string;
}

export type InventarioPayload = Omit<
  ScanSession,
  'id' | 'syncStatus' | 'syncAttempts' | 'lastAttemptAt' | 'nextRetryAt'
>;

export interface QrConnectorClient {
  authSession(): Promise<AuthSessionResult>;
  getCatalogo(organizacionId: string, areaId?: string, ubicacionId?: string): Promise<ConnectorAsset[]>;
  postInventario(session: InventarioPayload): Promise<InventarioResult>;
  getInventarioEstado(inventarioId: string): Promise<InventarioEstado>;
}

// DOC-002 §5: 400 (payload rechazado, ej. organización inexistente) y 409 (idempotencyKey
// reutilizada con payload distinto) son rechazos permanentes — nunca hay que reintentarlos. Se
// distinguen de una falla transitoria (5xx/red) con un tipo de error propio para que
// sync-queue.ts (TASK-008) sepa cuándo dejar de insistir (`SyncStatus.rejected`) en vez de
// reintentar para siempre un payload que CORE nunca va a aceptar.
export class RejectedInventarioError extends Error {
  constructor(
    message: string,
    readonly errores?: string[],
  ) {
    super(message);
    this.name = 'RejectedInventarioError';
  }
}

interface ErrorBody {
  message?: string;
  errores?: Array<{ campo: string; detalle: string } | string>;
}

function flattenErrores(errores: ErrorBody['errores']): string[] | undefined {
  if (!errores) return undefined;
  return errores.map((e) => (typeof e === 'string' ? e : `${e.campo}: ${e.detalle}`));
}

async function parseErrorBody(res: Response): Promise<ErrorBody> {
  try {
    return (await res.json()) as ErrorBody;
  } catch {
    return {};
  }
}

async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = loadOidcConfig();
  // Deja pasar AuthenticationRequiredError tal cual — ScanPage.tsx la interpreta como "mandar al
  // operador a loguearse de nuevo" (ver handleDecode/OperatorGate), no como una falla transitoria
  // de red que sync-queue.ts deba reintentar.
  const accessToken = await oidcClient.getValidAccessToken();

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body) headers.set('Content-Type', 'application/json');

  return fetch(`${config.cisUrl}${path}`, { ...init, headers });
}

class HttpQrConnectorClient implements QrConnectorClient {
  async authSession(): Promise<AuthSessionResult> {
    const res = await authorizedFetch('/auth/session', {
      method: 'POST',
      body: JSON.stringify({ deviceId: getOrCreateDeviceId() }),
    });
    if (!res.ok) {
      const body = await parseErrorBody(res);
      throw new Error(body.message ?? `No se pudo iniciar sesión (${res.status})`);
    }
    return (await res.json()) as AuthSessionResult;
  }

  async getCatalogo(organizacionId: string, areaId?: string, ubicacionId?: string): Promise<ConnectorAsset[]> {
    const params = new URLSearchParams({ organizacionId });
    if (areaId) params.set('areaId', areaId);
    if (ubicacionId) params.set('ubicacionId', ubicacionId);

    const res = await authorizedFetch(`/catalogo?${params.toString()}`);
    if (!res.ok) {
      const body = await parseErrorBody(res);
      throw new Error(body.message ?? `No se pudo traer el catálogo (${res.status})`);
    }
    const body = (await res.json()) as { activos: ConnectorAsset[] };
    return body.activos;
  }

  async postInventario(session: InventarioPayload): Promise<InventarioResult> {
    const res = await authorizedFetch('/inventarios', {
      method: 'POST',
      body: JSON.stringify(session),
    });

    if (res.status === 400 || res.status === 409) {
      const body = await parseErrorBody(res);
      throw new RejectedInventarioError(
        body.message ?? `CORE rechazó el inventario (${res.status})`,
        flattenErrores(body.errores),
      );
    }
    if (!res.ok) {
      const body = await parseErrorBody(res);
      throw new Error(body.message ?? `No se pudo enviar el inventario (${res.status})`);
    }
    return (await res.json()) as InventarioResult;
  }

  async getInventarioEstado(inventarioId: string): Promise<InventarioEstado> {
    const res = await authorizedFetch(`/inventarios/${encodeURIComponent(inventarioId)}/estado`);
    if (!res.ok) {
      const body = await parseErrorBody(res);
      throw new Error(body.message ?? `No se pudo consultar el estado (${res.status})`);
    }
    return (await res.json()) as InventarioEstado;
  }
}

export const qrConnector: QrConnectorClient = new HttpQrConnectorClient();

// Arma el árbol organización→área→ubicación que espera la UI (OrganizationPicker,
// AreaLocationPicker) a partir del catálogo completo de una organización — CIS no tiene un
// endpoint propio para listar áreas/ubicaciones (decisión confirmada explícitamente: no hay otra
// forma de poblar el picker sin inventar un endpoint nuevo del lado de CIS/CORE). El nombre de
// área no existe en el contrato (`activos[].areaId` es solo un id, sin campo `nombre` propio) —
// se muestra el id tal cual. El nombre de ubicación sí está disponible: se resuelve contra
// `sedes[]` de `AuthSessionResult` cuando el id calza.
export function buildOrganizationTree(
  summary: OrganizacionSummary,
  catalogo: ConnectorAsset[],
): Organization {
  const areasById = new Map<string, OrgArea>();

  for (const activo of catalogo) {
    if (activo.organizacionId !== summary.id || !activo.areaId || !activo.ubicacionId) continue;

    let area = areasById.get(activo.areaId);
    if (!area) {
      area = { id: activo.areaId, name: activo.areaId, locations: [] };
      areasById.set(activo.areaId, area);
    }

    if (!area.locations.some((location) => location.id === activo.ubicacionId)) {
      const sede = summary.sedes.find((s) => s.id === activo.ubicacionId);
      const location: OrgLocation = { id: activo.ubicacionId, name: sede?.nombre ?? activo.ubicacionId };
      area.locations.push(location);
    }
  }

  return { id: summary.id, name: summary.nombre, areas: Array.from(areasById.values()) };
}
