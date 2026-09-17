import type { CoreHttpExecutor } from './core-client.http-executor';
import type { CatalogoQuery } from '../qr-connector/qr-connector.schemas';
import {
  catalogoResponseSchema,
  catalogoTipoResponseSchema,
  catalogoTiposResponseSchema,
  type CatalogoResult,
  type CatalogoTipoResult,
  type PostCatalogoTipoRequest,
} from './core-client.types';

// DOC-006 2 — reemplaza SEED_CATALOGO (ROADMAP.md Fase 3).
export async function getCatalogo(
  http: CoreHttpExecutor,
  query: CatalogoQuery,
  correlationId: string,
): Promise<CatalogoResult> {
  const data = await http.get('/catalogo', query, correlationId);
  return http.parse(catalogoResponseSchema, data, 'catalogo');
}

// DOC-021 4 (gap "familias/categorías") — lectura abierta, mismo criterio que getCatalogo.
export async function getCatalogoTipos(
  http: CoreHttpExecutor,
  correlationId: string,
): Promise<CatalogoTipoResult[]> {
  const data = await http.get('/catalogo-tipos', undefined, correlationId);
  return http.parse(catalogoTiposResponseSchema, data, 'catalogo-tipos');
}

export async function postCatalogoTipo(
  http: CoreHttpExecutor,
  request: PostCatalogoTipoRequest,
  correlationId: string,
): Promise<CatalogoTipoResult> {
  const data = await http.post('/catalogo-tipos', request, correlationId, {
    passthroughStatuses: [400, 403, 409],
  });
  return http.parse(catalogoTipoResponseSchema, data, 'catalogo-tipos');
}
