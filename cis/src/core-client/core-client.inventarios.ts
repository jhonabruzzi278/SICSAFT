import type { CoreHttpExecutor } from './core-client.http-executor';
import type { InventarioRequest } from '../qr-connector/qr-connector.schemas';
import {
  inventarioEstadoResponseSchema,
  postInventarioResponseSchema,
  resumenControlResponseSchema,
  sesionDetalleResponseSchema,
  sesionesResumenResponseSchema,
  type InventarioEstadoResult,
  type PostInventarioResult,
  type ResumenControlResult,
  type SesionDetalleResult,
  type SesionResumenResult,
} from './core-client.types';

// DOC-006 3 — reemplaza los Map en memoria de QrConnectorService. A diferencia de
// getEntitlements/getCatalogo, acá SI se propaga el error de CORE (400/409) tal cual en vez de
// colapsarlo a 502 — DOC-002 5 exige que el cliente pueda distinguir "rechazado, no reintentar"
// (400/409) de "transitorio, reintentar" (5xx/timeout/circuito abierto).
export async function postInventario(
  http: CoreHttpExecutor,
  request: InventarioRequest,
  correlationId: string,
): Promise<PostInventarioResult> {
  const data = await http.post('/inventarios', request, correlationId);
  return http.parse(postInventarioResponseSchema, data, 'inventarios');
}

export async function getInventarioEstado(
  http: CoreHttpExecutor,
  inventarioId: string,
  correlationId: string,
): Promise<InventarioEstadoResult> {
  const data = await http.get(
    `/inventarios/${encodeURIComponent(inventarioId)}/estado`,
    undefined,
    correlationId,
  );
  return http.parse(inventarioEstadoResponseSchema, data, 'inventarios/estado');
}

// RF-04 (Fase 5, WEB) — lectura abierta, mismo criterio que getCatalogo/getContratos.
export async function getInventarios(
  http: CoreHttpExecutor,
  organizacionId: string,
  correlationId: string,
): Promise<SesionResumenResult[]> {
  const data = await http.get(
    '/inventarios',
    { organizacionId },
    correlationId,
  );
  return http.parse(sesionesResumenResponseSchema, data, 'inventarios');
}

export async function getInventarioDetalle(
  http: CoreHttpExecutor,
  inventarioId: string,
  correlationId: string,
): Promise<SesionDetalleResult> {
  const data = await http.get(
    `/inventarios/${encodeURIComponent(inventarioId)}`,
    undefined,
    correlationId,
  );
  return http.parse(sesionDetalleResponseSchema, data, 'inventarios/detalle');
}

// DOC-029 RF-I — informe de control de área de una sesión ("Pantalla 8"). Lectura abierta, mismo
// criterio que getInventarioDetalle.
export async function getInventarioResumenControl(
  http: CoreHttpExecutor,
  inventarioId: string,
  correlationId: string,
): Promise<ResumenControlResult> {
  const data = await http.get(
    `/inventarios/${encodeURIComponent(inventarioId)}/control`,
    undefined,
    correlationId,
  );
  return http.parse(resumenControlResponseSchema, data, 'inventarios/control');
}
