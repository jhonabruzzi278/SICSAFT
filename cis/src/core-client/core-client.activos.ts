import type { CoreHttpExecutor } from './core-client.http-executor';
import {
  activoResponseSchema,
  documentoActivoResponseSchema,
  documentosActivoResponseSchema,
  type ActivoResult,
  type DocumentoActivoResult,
  type EscrituraOficialRequest,
  type PatchActivoDescripcionRequest,
  type PatchActivoResponsableRequest,
  type PostActivoRequest,
  type PostDocumentoActivoRequest,
} from './core-client.types';

// DOC-012 5 — proxy hacia POST /activos de CORE (escritura oficial). Se propaga tambien un 403
// (falta el rol administrador-patrimonial en esa organizacion) ademas de 400/409 — DOC-012 8
// exige que el 403 llegue tal cual, no colapsado a 502, para que WEB pueda distinguir "sin
// permiso" de "CORE caido".
export async function postActivo(
  http: CoreHttpExecutor,
  request: PostActivoRequest,
  correlationId: string,
): Promise<ActivoResult> {
  const data = await http.post('/activos', request, correlationId, {
    passthroughStatuses: [400, 403, 409],
  });
  return http.parse(activoResponseSchema, data, 'activos');
}

// DOC-021 3 (gap "estados") — proxy hacia POST /activos/:id/baja y /reincorporacion de CORE.
export async function postActivoBaja(
  http: CoreHttpExecutor,
  activoId: string,
  request: EscrituraOficialRequest,
  correlationId: string,
): Promise<ActivoResult> {
  const data = await http.post(
    `/activos/${encodeURIComponent(activoId)}/baja`,
    request,
    correlationId,
    { passthroughStatuses: [400, 403, 404, 409] },
  );
  return http.parse(activoResponseSchema, data, 'activos');
}

export async function postActivoReincorporacion(
  http: CoreHttpExecutor,
  activoId: string,
  request: EscrituraOficialRequest,
  correlationId: string,
): Promise<ActivoResult> {
  const data = await http.post(
    `/activos/${encodeURIComponent(activoId)}/reincorporacion`,
    request,
    correlationId,
    { passthroughStatuses: [400, 403, 404, 409] },
  );
  return http.parse(activoResponseSchema, data, 'activos');
}

export async function patchActivoResponsable(
  http: CoreHttpExecutor,
  activoId: string,
  request: PatchActivoResponsableRequest,
  correlationId: string,
): Promise<ActivoResult> {
  const data = await http.patch(
    `/activos/${encodeURIComponent(activoId)}/responsable`,
    request,
    correlationId,
    { passthroughStatuses: [400, 403, 404, 409] },
  );
  return http.parse(activoResponseSchema, data, 'activos');
}

// DOC-021 3 (gap "descripciones").
export async function patchActivoDescripcion(
  http: CoreHttpExecutor,
  activoId: string,
  request: PatchActivoDescripcionRequest,
  correlationId: string,
): Promise<ActivoResult> {
  const data = await http.patch(
    `/activos/${encodeURIComponent(activoId)}/descripcion`,
    request,
    correlationId,
    { passthroughStatuses: [400, 403, 404, 409] },
  );
  return http.parse(activoResponseSchema, data, 'activos');
}

// DOC-021 3 (gap "documentación y fotografías").
export async function getDocumentosActivo(
  http: CoreHttpExecutor,
  activoId: string,
  organizacionId: string,
  correlationId: string,
): Promise<DocumentoActivoResult[]> {
  const data = await http.get(
    `/activos/${encodeURIComponent(activoId)}/documentos`,
    { organizacionId },
    correlationId,
  );
  return http.parse(documentosActivoResponseSchema, data, 'documentos');
}

export async function postDocumentoActivo(
  http: CoreHttpExecutor,
  activoId: string,
  request: PostDocumentoActivoRequest,
  correlationId: string,
): Promise<DocumentoActivoResult> {
  const data = await http.post(
    `/activos/${encodeURIComponent(activoId)}/documentos`,
    request,
    correlationId,
    { passthroughStatuses: [400, 403, 404, 409] },
  );
  return http.parse(documentoActivoResponseSchema, data, 'documentos');
}

export async function deleteDocumentoActivo(
  http: CoreHttpExecutor,
  activoId: string,
  documentoId: string,
  request: EscrituraOficialRequest,
  correlationId: string,
): Promise<void> {
  await http.delete(
    `/activos/${encodeURIComponent(activoId)}/documentos/${encodeURIComponent(documentoId)}`,
    request,
    correlationId,
    { passthroughStatuses: [400, 403, 404] },
  );
}
