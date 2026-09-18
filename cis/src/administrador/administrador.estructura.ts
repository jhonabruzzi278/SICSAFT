import type { CoreClientService } from '../core-client/core-client.service';
import type { KeycloakAuthContext } from '../common/auth/keycloak-auth.guard';
import type {
  AreaResult,
  AreasPaginaResult,
  Paginacion,
  ResponsableResult,
  ResponsablesPaginaResult,
  UbicacionResult,
  UbicacionesPaginaResult,
} from '../core-client/core-client.types';
import type {
  ActualizarAreaBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  AltaAreaBody,
  AltaResponsableBody,
  AltaUbicacionBody,
} from './administrador.schemas';

// RF-05 (Fase 5) — lectura abierta, mismo criterio que getAuditoria. Paginado (RNF-01, cierra el
// gap).
export function getAreas(
  coreClientService: CoreClientService,
  organizacionId: string,
  paginacion: Paginacion,
  correlationId: string,
): Promise<AreasPaginaResult> {
  return coreClientService.getAreas(organizacionId, paginacion, correlationId);
}

export function altaArea(
  coreClientService: CoreClientService,
  body: AltaAreaBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<AreaResult> {
  return coreClientService.postArea(
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

// RF-05 (cierra el gap "ABM completo") — PATCH /admin/areas/:id.
export function actualizarArea(
  coreClientService: CoreClientService,
  areaId: string,
  body: ActualizarAreaBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<AreaResult> {
  return coreClientService.patchArea(
    areaId,
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

// Paginado (RNF-01, cierra el gap).
export function getUbicaciones(
  coreClientService: CoreClientService,
  sedeId: string,
  paginacion: Paginacion,
  correlationId: string,
): Promise<UbicacionesPaginaResult> {
  return coreClientService.getUbicaciones(sedeId, paginacion, correlationId);
}

export function altaUbicacion(
  coreClientService: CoreClientService,
  body: AltaUbicacionBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<UbicacionResult> {
  return coreClientService.postUbicacion(
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

// RF-05 (cierra el gap "ABM completo") — PATCH /admin/ubicaciones/:id.
export function actualizarUbicacion(
  coreClientService: CoreClientService,
  ubicacionId: string,
  body: ActualizarUbicacionBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<UbicacionResult> {
  return coreClientService.patchUbicacion(
    ubicacionId,
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

// Paginado (RNF-01, cierra el gap).
export function getResponsables(
  coreClientService: CoreClientService,
  areaId: string,
  paginacion: Paginacion,
  correlationId: string,
): Promise<ResponsablesPaginaResult> {
  return coreClientService.getResponsables(areaId, paginacion, correlationId);
}

export function altaResponsable(
  coreClientService: CoreClientService,
  body: AltaResponsableBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<ResponsableResult> {
  return coreClientService.postResponsable(
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}

export function actualizarEstadoResponsable(
  coreClientService: CoreClientService,
  responsableId: string,
  body: ActualizarEstadoResponsableBody,
  auth: KeycloakAuthContext,
  correlationId: string,
): Promise<ResponsableResult> {
  return coreClientService.patchResponsableEstado(
    responsableId,
    {
      ...body,
      correlationId,
      operadorId: auth.operadorId,
      rolesPorOrganizacion: auth.rolesPorOrganizacion,
    },
    correlationId,
  );
}
