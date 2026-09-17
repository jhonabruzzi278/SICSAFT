import type { CoreHttpExecutor } from './core-client.http-executor';
import {
  auditoriaPaginaResponseSchema,
  type AuditoriaFiltro,
  type AuditoriaPaginaResult,
  type PostAuditoriaRequest,
} from './core-client.types';

// RF-06 (Fase 5, WEB) — lectura abierta, mismo criterio que getCatalogo/getContratos. Paginado
// (RNF-01, cierra el gap).
export async function getAuditoria(
  http: CoreHttpExecutor,
  filtro: AuditoriaFiltro,
  correlationId: string,
): Promise<AuditoriaPaginaResult> {
  const data = await http.get(
    '/auditoria',
    {
      usuario: filtro.usuario,
      operacion: filtro.operacion,
      fechaDesde: filtro.fechaDesde,
      fechaHasta: filtro.fechaHasta,
      area: filtro.area,
      limit: filtro.limit,
      offset: filtro.offset,
    },
    correlationId,
  );
  return http.parse(auditoriaPaginaResponseSchema, data, 'auditoria');
}

// DOC-024 3 — POST /auditoria. Reporta a CORE el resultado de una operacion de identidad en
// Zitadel que nunca pasa por el Orquestador (asignar/quitar rol, crear organizacion en Zitadel)
// — ver cis/src/auditoria-identidad/auditoria-identidad.service.ts. Sin passthroughStatuses: si
// esto falla, no hay un rechazo de negocio que distinguir, es simplemente "no se pudo auditar" —
// 502 genérico alcanza (ver AuditoriaIdentidadService, que no atrapa este fallo a propósito,
// DOC-024 3).
export async function postAuditoria(
  http: CoreHttpExecutor,
  request: PostAuditoriaRequest,
  correlationId: string,
): Promise<void> {
  await http.post('/auditoria', request, correlationId, {
    passthroughStatuses: [],
  });
}
