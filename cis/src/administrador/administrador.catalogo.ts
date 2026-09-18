import type { CoreClientService } from '../core-client/core-client.service';
import type { KeycloakAuthContext } from '../common/auth/keycloak-auth.guard';
import type { CatalogoTipoResult } from '../core-client/core-client.types';
import type { AltaCatalogoTipoBody } from './administrador.schemas';

// DOC-021 4 (gap "familias/categorías") — lectura abierta, mismo criterio que getAuditoria.
export function getCatalogoTipos(
  coreClientService: CoreClientService,
  correlationId: string,
): Promise<CatalogoTipoResult[]> {
  return coreClientService.getCatalogoTipos(correlationId);
}

export function altaCatalogoTipo(
  coreClientService: CoreClientService,
  body: AltaCatalogoTipoBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<CatalogoTipoResult> {
  return coreClientService.postCatalogoTipo(
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}
