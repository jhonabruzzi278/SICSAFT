import type { CoreHttpExecutor } from './core-client.http-executor';
import {
  crearLoteImportacionContableResponseSchema,
  importacionContableResponseSchema,
  loteConFilasImportacionContableResponseSchema,
  lotesImportacionContableResponseSchema,
  rechazoLoteImportacionContableResponseSchema,
  type AprobarLoteImportacionContableRequest,
  type CrearLoteImportacionContableResult,
  type ImportacionContableResult,
  type LoteConFilasImportacionContableResult,
  type LoteImportacionContableResult,
  type PostImportacionContableRequest,
  type PostLoteImportacionContableRequest,
  type RechazarLoteImportacionContableRequest,
  type RechazoLoteImportacionContableResult,
} from './core-client.types';

// DOC-012 6 (gap "importaciones controladas") — proxy hacia POST /importaciones/contable de
// CORE, idempotente por fila (nunca 409 a nivel de request completo, ver
// ImportacionContableService).
export async function postImportacionContable(
  http: CoreHttpExecutor,
  request: PostImportacionContableRequest,
  correlationId: string,
): Promise<ImportacionContableResult> {
  const data = await http.post(
    '/importaciones/contable',
    request,
    correlationId,
    {
      passthroughStatuses: [400, 403],
    },
  );
  return http.parse(
    importacionContableResponseSchema,
    data,
    'importaciones/contable',
  );
}

// DOC-029 RF-B — bandeja de staging. crear/aprobar/rechazar son escrituras oficiales (CORE
// verifica el rol desde rolesPorOrganizacion y audita); listar/obtener son lecturas.
export async function postLoteImportacionContable(
  http: CoreHttpExecutor,
  request: PostLoteImportacionContableRequest,
  correlationId: string,
): Promise<CrearLoteImportacionContableResult> {
  const data = await http.post(
    '/importaciones/contable/lote',
    request,
    correlationId,
    { passthroughStatuses: [400, 403] },
  );
  return http.parse(
    crearLoteImportacionContableResponseSchema,
    data,
    'importaciones/contable/lote',
  );
}

export async function getLotesImportacionContable(
  http: CoreHttpExecutor,
  organizacionId: string,
  estado: string | undefined,
  correlationId: string,
): Promise<LoteImportacionContableResult[]> {
  const data = await http.get(
    '/importaciones/contable/lote',
    { organizacionId, estado },
    correlationId,
  );
  return http.parse(
    lotesImportacionContableResponseSchema,
    data,
    'importaciones/contable/lote',
  );
}

export async function getLoteImportacionContable(
  http: CoreHttpExecutor,
  loteId: string,
  correlationId: string,
): Promise<LoteConFilasImportacionContableResult> {
  const data = await http.get(
    `/importaciones/contable/lote/${encodeURIComponent(loteId)}`,
    undefined,
    correlationId,
  );
  return http.parse(
    loteConFilasImportacionContableResponseSchema,
    data,
    'importaciones/contable/lote/:id',
  );
}

export async function postAprobarLoteImportacionContable(
  http: CoreHttpExecutor,
  loteId: string,
  request: AprobarLoteImportacionContableRequest,
  correlationId: string,
): Promise<ImportacionContableResult> {
  const data = await http.post(
    `/importaciones/contable/lote/${encodeURIComponent(loteId)}/aprobar`,
    request,
    correlationId,
    { passthroughStatuses: [400, 403, 404, 409] },
  );
  return http.parse(
    importacionContableResponseSchema,
    data,
    'importaciones/contable/lote/:id/aprobar',
  );
}

export async function postRechazarLoteImportacionContable(
  http: CoreHttpExecutor,
  loteId: string,
  request: RechazarLoteImportacionContableRequest,
  correlationId: string,
): Promise<RechazoLoteImportacionContableResult> {
  const data = await http.post(
    `/importaciones/contable/lote/${encodeURIComponent(loteId)}/rechazar`,
    request,
    correlationId,
    { passthroughStatuses: [400, 403, 404, 409] },
  );
  return http.parse(
    rechazoLoteImportacionContableResponseSchema,
    data,
    'importaciones/contable/lote/:id/rechazar',
  );
}
