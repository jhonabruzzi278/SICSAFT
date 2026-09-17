import type { CoreHttpExecutor } from './core-client.http-executor';
import {
  areaResponseSchema,
  areasPaginaResponseSchema,
  responsableResponseSchema,
  responsablesPaginaResponseSchema,
  ubicacionResponseSchema,
  ubicacionesPaginaResponseSchema,
  type AreaResult,
  type AreasPaginaResult,
  type Paginacion,
  type PatchAreaRequest,
  type PatchResponsableEstadoRequest,
  type PatchUbicacionRequest,
  type PostAreaRequest,
  type PostResponsableRequest,
  type PostUbicacionRequest,
  type ResponsableResult,
  type ResponsablesPaginaResult,
  type UbicacionResult,
  type UbicacionesPaginaResult,
} from './core-client.types';

// RF-05 (Fase 5, WEB) — lectura abierta, mismo criterio que getCatalogo/getContratos. Paginado
// (RNF-01, cierra el gap).
export async function getAreas(
  http: CoreHttpExecutor,
  organizacionId: string,
  paginacion: Paginacion,
  correlationId: string,
): Promise<AreasPaginaResult> {
  const data = await http.get(
    '/areas',
    { organizacionId, limit: paginacion.limit, offset: paginacion.offset },
    correlationId,
  );
  return http.parse(areasPaginaResponseSchema, data, 'areas');
}

// RF-05 — escritura oficial, mismo criterio de passthroughStatuses que postActivo.
export async function postArea(
  http: CoreHttpExecutor,
  request: PostAreaRequest,
  correlationId: string,
): Promise<AreaResult> {
  const data = await http.post('/areas', request, correlationId, {
    passthroughStatuses: [400, 403, 409],
  });
  return http.parse(areaResponseSchema, data, 'areas');
}

// RF-05 (cierra el gap "ABM completo") — PATCH /areas/:id. Sin 404 en passthroughStatuses:
// callCore ya lo traduce a NotFoundException antes de mirar la lista (mismo criterio que
// patchContrato/patchResponsableEstado).
export async function patchArea(
  http: CoreHttpExecutor,
  areaId: string,
  request: PatchAreaRequest,
  correlationId: string,
): Promise<AreaResult> {
  const data = await http.patch(
    `/areas/${encodeURIComponent(areaId)}`,
    request,
    correlationId,
    { passthroughStatuses: [400, 403, 409] },
  );
  return http.parse(areaResponseSchema, data, 'areas');
}

// Paginado (RNF-01, cierra el gap).
export async function getUbicaciones(
  http: CoreHttpExecutor,
  sedeId: string,
  paginacion: Paginacion,
  correlationId: string,
): Promise<UbicacionesPaginaResult> {
  const data = await http.get(
    '/ubicaciones',
    { sedeId, limit: paginacion.limit, offset: paginacion.offset },
    correlationId,
  );
  return http.parse(ubicacionesPaginaResponseSchema, data, 'ubicaciones');
}

export async function postUbicacion(
  http: CoreHttpExecutor,
  request: PostUbicacionRequest,
  correlationId: string,
): Promise<UbicacionResult> {
  const data = await http.post('/ubicaciones', request, correlationId, {
    passthroughStatuses: [400, 403, 409],
  });
  return http.parse(ubicacionResponseSchema, data, 'ubicaciones');
}

// RF-05 (cierra el gap "ABM completo") — PATCH /ubicaciones/:id.
export async function patchUbicacion(
  http: CoreHttpExecutor,
  ubicacionId: string,
  request: PatchUbicacionRequest,
  correlationId: string,
): Promise<UbicacionResult> {
  const data = await http.patch(
    `/ubicaciones/${encodeURIComponent(ubicacionId)}`,
    request,
    correlationId,
    { passthroughStatuses: [400, 403, 409] },
  );
  return http.parse(ubicacionResponseSchema, data, 'ubicaciones');
}

// Paginado (RNF-01, cierra el gap).
export async function getResponsables(
  http: CoreHttpExecutor,
  areaId: string,
  paginacion: Paginacion,
  correlationId: string,
): Promise<ResponsablesPaginaResult> {
  const data = await http.get(
    '/responsables',
    { areaId, limit: paginacion.limit, offset: paginacion.offset },
    correlationId,
  );
  return http.parse(responsablesPaginaResponseSchema, data, 'responsables');
}

export async function postResponsable(
  http: CoreHttpExecutor,
  request: PostResponsableRequest,
  correlationId: string,
): Promise<ResponsableResult> {
  const data = await http.post('/responsables', request, correlationId, {
    passthroughStatuses: [400, 403, 409],
  });
  return http.parse(responsableResponseSchema, data, 'responsables');
}

export async function patchResponsableEstado(
  http: CoreHttpExecutor,
  responsableId: string,
  request: PatchResponsableEstadoRequest,
  correlationId: string,
): Promise<ResponsableResult> {
  // Sin 404 en passthroughStatuses a proposito: callCore ya lo traduce a NotFoundException antes
  // de mirar la lista (mismo criterio que patchContrato).
  const data = await http.patch(
    `/responsables/${encodeURIComponent(responsableId)}/estado`,
    request,
    correlationId,
    { passthroughStatuses: [400, 403, 409] },
  );
  return http.parse(responsableResponseSchema, data, 'responsables');
}
