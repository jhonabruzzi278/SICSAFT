import type { CoreClientService } from '../core-client/core-client.service';
import type {
  AuditoriaFiltro,
  AuditoriaPaginaResult,
} from '../core-client/core-client.types';

// RF-06 (Fase 5) — lectura abierta.
export function getAuditoria(
  coreClientService: CoreClientService,
  filtro: AuditoriaFiltro,
  correlationId: string,
): Promise<AuditoriaPaginaResult> {
  return coreClientService.getAuditoria(filtro, correlationId);
}
