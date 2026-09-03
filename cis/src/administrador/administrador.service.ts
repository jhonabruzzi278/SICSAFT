import { Injectable } from '@nestjs/common';
import { CoreClientService } from '../core-client/core-client.service';
import type {
  ActivoResult,
  AreaResult,
  AreasPaginaResult,
  AuditoriaFiltro,
  AuditoriaPaginaResult,
  CatalogoTipoResult,
  DocumentoActivoResult,
  ImportacionContableResult,
  CrearLoteImportacionContableResult,
  LoteImportacionContableResult,
  LoteConFilasImportacionContableResult,
  RechazoLoteImportacionContableResult,
  Paginacion,
  ResponsableResult,
  ResponsablesPaginaResult,
  UbicacionResult,
  UbicacionesPaginaResult,
} from '../core-client/core-client.types';
import type { KeycloakAuthContext } from '../common/auth/keycloak-auth.guard';
import type {
  ActualizarDescripcionActivoBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaCatalogoTipoBody,
  AltaDocumentoActivoBody,
  AltaResponsableBody,
  AltaUbicacionBody,
  ActualizarAreaBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  CambioResponsableActivoBody,
  EscrituraOficialActivoBody,
  ImportacionContableBody,
  CrearLoteImportacionContableBody,
  AprobarLoteImportacionContableBody,
  RechazarLoteImportacionContableBody,
} from './administrador.schemas';

// DOC-012 5 (Fase 4/5) — puente WEB->CIS->CORE para la escritura oficial de Activo y la estructura
// (areas/ubicaciones/responsables). WEB nunca le habla a CORE directo (regla no negociable de
// CLAUDE.md) — este servicio traduce el contexto ya autenticado por Keycloak (KeycloakAuthGuard)
// al contrato de escritura oficial que CORE espera (DOC-012 3.3).
//
// 2026-09: las operaciones de Organizacion/Contrato/Sede/usuarios/indicadores se retiraron al
// eliminar el portal del Administrador del Sistema — el proveedor externo interviene en el core de
// la organizacion de forma directa (BD / script con service-token) + el bootstrap del wizard.
@Injectable()
export class AdministradorService {
  constructor(private readonly coreClientService: CoreClientService) {}

  altaActivo(
    body: AltaActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.postActivo(
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
  bajaActivo(
    activoId: string,
    body: EscrituraOficialActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.postActivoBaja(
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

  reincorporarActivo(
    activoId: string,
    body: EscrituraOficialActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.postActivoReincorporacion(
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

  cambiarResponsableActivo(
    activoId: string,
    body: CambioResponsableActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.patchActivoResponsable(
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
  actualizarDescripcionActivo(
    activoId: string,
    body: ActualizarDescripcionActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return this.coreClientService.patchActivoDescripcion(
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

  // DOC-021 4 (gap "familias/categorías") — lectura abierta, mismo criterio que getAuditoria.
  getCatalogoTipos(correlationId: string): Promise<CatalogoTipoResult[]> {
    return this.coreClientService.getCatalogoTipos(correlationId);
  }

  altaCatalogoTipo(
    body: AltaCatalogoTipoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<CatalogoTipoResult> {
    return this.coreClientService.postCatalogoTipo(
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
  getDocumentosActivo(
    activoId: string,
    organizacionId: string,
    correlationId: string,
  ): Promise<DocumentoActivoResult[]> {
    return this.coreClientService.getDocumentosActivo(
      activoId,
      organizacionId,
      correlationId,
    );
  }

  altaDocumentoActivo(
    activoId: string,
    body: AltaDocumentoActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<DocumentoActivoResult> {
    return this.coreClientService.postDocumentoActivo(
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

  eliminarDocumentoActivo(
    activoId: string,
    documentoId: string,
    body: EscrituraOficialActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<void> {
    return this.coreClientService.deleteDocumentoActivo(
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

  // DOC-012 6 (gap "importaciones controladas").
  importarContable(
    body: ImportacionContableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ImportacionContableResult> {
    return this.coreClientService.postImportacionContable(
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
  crearLoteImportacionContable(
    body: CrearLoteImportacionContableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<CrearLoteImportacionContableResult> {
    return this.coreClientService.postLoteImportacionContable(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  listarLotesImportacionContable(
    organizacionId: string,
    estado: string | undefined,
    correlationId: string,
  ): Promise<LoteImportacionContableResult[]> {
    return this.coreClientService.getLotesImportacionContable(
      organizacionId,
      estado,
      correlationId,
    );
  }

  obtenerLoteImportacionContable(
    loteId: string,
    correlationId: string,
  ): Promise<LoteConFilasImportacionContableResult> {
    return this.coreClientService.getLoteImportacionContable(
      loteId,
      correlationId,
    );
  }

  aprobarLoteImportacionContable(
    loteId: string,
    body: AprobarLoteImportacionContableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ImportacionContableResult> {
    return this.coreClientService.postAprobarLoteImportacionContable(
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

  rechazarLoteImportacionContable(
    loteId: string,
    body: RechazarLoteImportacionContableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<RechazoLoteImportacionContableResult> {
    return this.coreClientService.postRechazarLoteImportacionContable(
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

  // RF-06 (Fase 5) — lectura abierta.
  getAuditoria(
    filtro: AuditoriaFiltro,
    correlationId: string,
  ): Promise<AuditoriaPaginaResult> {
    return this.coreClientService.getAuditoria(filtro, correlationId);
  }

  // RF-05 (Fase 5) — lectura abierta, mismo criterio que getAuditoria. Paginado (RNF-01, cierra
  // el gap).
  getAreas(
    organizacionId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<AreasPaginaResult> {
    return this.coreClientService.getAreas(
      organizacionId,
      paginacion,
      correlationId,
    );
  }

  altaArea(
    body: AltaAreaBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<AreaResult> {
    return this.coreClientService.postArea(
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
  actualizarArea(
    areaId: string,
    body: ActualizarAreaBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<AreaResult> {
    return this.coreClientService.patchArea(
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
  getUbicaciones(
    sedeId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<UbicacionesPaginaResult> {
    return this.coreClientService.getUbicaciones(
      sedeId,
      paginacion,
      correlationId,
    );
  }

  altaUbicacion(
    body: AltaUbicacionBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<UbicacionResult> {
    return this.coreClientService.postUbicacion(
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
  actualizarUbicacion(
    ubicacionId: string,
    body: ActualizarUbicacionBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<UbicacionResult> {
    return this.coreClientService.patchUbicacion(
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
  getResponsables(
    areaId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<ResponsablesPaginaResult> {
    return this.coreClientService.getResponsables(
      areaId,
      paginacion,
      correlationId,
    );
  }

  altaResponsable(
    body: AltaResponsableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ResponsableResult> {
    return this.coreClientService.postResponsable(
      {
        ...body,
        correlationId,
        operadorId: auth.operadorId,
        rolesPorOrganizacion: auth.rolesPorOrganizacion,
      },
      correlationId,
    );
  }

  actualizarEstadoResponsable(
    responsableId: string,
    body: ActualizarEstadoResponsableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ResponsableResult> {
    return this.coreClientService.patchResponsableEstado(
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
}
