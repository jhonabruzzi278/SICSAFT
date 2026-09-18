import type { CoreClientService } from '../core-client/core-client.service';
import type { KeycloakAuthContext } from '../common/auth/keycloak-auth.guard';
import type {
  ActivoResult,
  DocumentoActivoResult,
} from '../core-client/core-client.types';
import type {
  ActualizarDescripcionActivoBody,
  AltaActivoBody,
  AltaDocumentoActivoBody,
  CambioResponsableActivoBody,
  EscrituraOficialActivoBody,
} from './administrador.schemas';

export function altaActivo(
  coreClientService: CoreClientService,
  body: AltaActivoBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<ActivoResult> {
  return coreClientService.postActivo(
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

// DOC-021 3 (gap "estados") — baja/reincorporacion/responsable/descripcion de Activo.
export function bajaActivo(
  coreClientService: CoreClientService,
  activoId: string,
  body: EscrituraOficialActivoBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<ActivoResult> {
  return coreClientService.postActivoBaja(
    activoId,
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

export function reincorporarActivo(
  coreClientService: CoreClientService,
  activoId: string,
  body: EscrituraOficialActivoBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<ActivoResult> {
  return coreClientService.postActivoReincorporacion(
    activoId,
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

export function cambiarResponsableActivo(
  coreClientService: CoreClientService,
  activoId: string,
  body: CambioResponsableActivoBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<ActivoResult> {
  return coreClientService.patchActivoResponsable(
    activoId,
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

// DOC-021 3 (gap "descripciones").
export function actualizarDescripcionActivo(
  coreClientService: CoreClientService,
  activoId: string,
  body: ActualizarDescripcionActivoBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<ActivoResult> {
  return coreClientService.patchActivoDescripcion(
    activoId,
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

// DOC-021 3 (gap "documentación y fotografías").
export function getDocumentosActivo(
  coreClientService: CoreClientService,
  activoId: string,
  organizacionId: string,
  correlationId: string,
): Promise<DocumentoActivoResult[]> {
  return coreClientService.getDocumentosActivo(
    activoId,
    organizacionId,
    correlationId,
  );
}

export function altaDocumentoActivo(
  coreClientService: CoreClientService,
  activoId: string,
  body: AltaDocumentoActivoBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<DocumentoActivoResult> {
  return coreClientService.postDocumentoActivo(
    activoId,
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

export function eliminarDocumentoActivo(
  coreClientService: CoreClientService,
  activoId: string,
  documentoId: string,
  body: EscrituraOficialActivoBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<void> {
  return coreClientService.deleteDocumentoActivo(
    activoId,
    documentoId,
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}
