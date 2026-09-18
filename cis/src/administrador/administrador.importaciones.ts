import type { CoreClientService } from '../core-client/core-client.service';
import type { KeycloakAuthContext } from '../common/auth/keycloak-auth.guard';
import type {
  CrearLoteImportacionContableResult,
  ImportacionContableResult,
  LoteConFilasImportacionContableResult,
  LoteImportacionContableResult,
  RechazoLoteImportacionContableResult,
} from '../core-client/core-client.types';
import type {
  AprobarLoteImportacionContableBody,
  CrearLoteImportacionContableBody,
  ImportacionContableBody,
  RechazarLoteImportacionContableBody,
} from './administrador.schemas';

// DOC-012 6 (gap "importaciones controladas").
export function importarContable(
  coreClientService: CoreClientService,
  body: ImportacionContableBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<ImportacionContableResult> {
  return coreClientService.postImportacionContable(
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

// DOC-029 RF-B — bandeja de staging de la ingesta de Excel supervisada. crear/aprobar/rechazar
// inyectan la identidad del JWT (CORE verifica el rol y audita); listar/obtener son passthrough.
export function crearLoteImportacionContable(
  coreClientService: CoreClientService,
  body: CrearLoteImportacionContableBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<CrearLoteImportacionContableResult> {
  return coreClientService.postLoteImportacionContable(
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

export function listarLotesImportacionContable(
  coreClientService: CoreClientService,
  organizacionId: string,
  estado: string | undefined,
  correlationId: string,
): Promise<LoteImportacionContableResult[]> {
  return coreClientService.getLotesImportacionContable(
    organizacionId,
    estado,
    correlationId,
  );
}

export function obtenerLoteImportacionContable(
  coreClientService: CoreClientService,
  loteId: string,
  correlationId: string,
): Promise<LoteConFilasImportacionContableResult> {
  return coreClientService.getLoteImportacionContable(loteId, correlationId);
}

export function aprobarLoteImportacionContable(
  coreClientService: CoreClientService,
  loteId: string,
  body: AprobarLoteImportacionContableBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<ImportacionContableResult> {
  return coreClientService.postAprobarLoteImportacionContable(
    loteId,
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

export function rechazarLoteImportacionContable(
  coreClientService: CoreClientService,
  loteId: string,
  body: RechazarLoteImportacionContableBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<RechazoLoteImportacionContableResult> {
  return coreClientService.postRechazarLoteImportacionContable(
    loteId,
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}
