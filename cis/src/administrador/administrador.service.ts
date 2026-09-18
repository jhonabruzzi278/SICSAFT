import { Injectable } from '@nestjs/common';
import { CoreClientService } from '../core-client/core-client.service';
import * as activos from './administrador.activos';
import * as catalogo from './administrador.catalogo';
import * as importaciones from './administrador.importaciones';
import * as auditoria from './administrador.auditoria';
import * as estructura from './administrador.estructura';
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
// --
// Fachada delgada: cada dominio (Activos, Catálogo, Importaciones, Auditoría, Estructura) vive en
// su propio archivo administrador.<dominio>.ts como funciones puras que reciben
// `coreClientService` — mismo patrón que CoreClientService/CoreHttpExecutor. Mismo constructor y
// misma API pública de siempre para no romper a los 5 controllers que la inyectan ni el spec
// existente.
// --
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
    return activos.altaActivo(
      this.coreClientService,
      body,
      auth,
      correlationId,
    );
  }

  bajaActivo(
    activoId: string,
    body: EscrituraOficialActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return activos.bajaActivo(
      this.coreClientService,
      activoId,
      body,
      auth,
      correlationId,
    );
  }

  reincorporarActivo(
    activoId: string,
    body: EscrituraOficialActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return activos.reincorporarActivo(
      this.coreClientService,
      activoId,
      body,
      auth,
      correlationId,
    );
  }

  cambiarResponsableActivo(
    activoId: string,
    body: CambioResponsableActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return activos.cambiarResponsableActivo(
      this.coreClientService,
      activoId,
      body,
      auth,
      correlationId,
    );
  }

  actualizarDescripcionActivo(
    activoId: string,
    body: ActualizarDescripcionActivoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ActivoResult> {
    return activos.actualizarDescripcionActivo(
      this.coreClientService,
      activoId,
      body,
      auth,
      correlationId,
    );
  }

  getCatalogoTipos(correlationId: string): Promise<CatalogoTipoResult[]> {
    return catalogo.getCatalogoTipos(this.coreClientService, correlationId);
  }

  altaCatalogoTipo(
    body: AltaCatalogoTipoBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<CatalogoTipoResult> {
    return catalogo.altaCatalogoTipo(
      this.coreClientService,
      body,
      auth,
      correlationId,
    );
  }

  getDocumentosActivo(
    activoId: string,
    organizacionId: string,
    correlationId: string,
  ): Promise<DocumentoActivoResult[]> {
    return activos.getDocumentosActivo(
      this.coreClientService,
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
    return activos.altaDocumentoActivo(
      this.coreClientService,
      activoId,
      body,
      auth,
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
    return activos.eliminarDocumentoActivo(
      this.coreClientService,
      activoId,
      documentoId,
      body,
      auth,
      correlationId,
    );
  }

  importarContable(
    body: ImportacionContableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ImportacionContableResult> {
    return importaciones.importarContable(
      this.coreClientService,
      body,
      auth,
      correlationId,
    );
  }

  crearLoteImportacionContable(
    body: CrearLoteImportacionContableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<CrearLoteImportacionContableResult> {
    return importaciones.crearLoteImportacionContable(
      this.coreClientService,
      body,
      auth,
      correlationId,
    );
  }

  listarLotesImportacionContable(
    organizacionId: string,
    estado: string | undefined,
    correlationId: string,
  ): Promise<LoteImportacionContableResult[]> {
    return importaciones.listarLotesImportacionContable(
      this.coreClientService,
      organizacionId,
      estado,
      correlationId,
    );
  }

  obtenerLoteImportacionContable(
    loteId: string,
    correlationId: string,
  ): Promise<LoteConFilasImportacionContableResult> {
    return importaciones.obtenerLoteImportacionContable(
      this.coreClientService,
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
    return importaciones.aprobarLoteImportacionContable(
      this.coreClientService,
      loteId,
      body,
      auth,
      correlationId,
    );
  }

  rechazarLoteImportacionContable(
    loteId: string,
    body: RechazarLoteImportacionContableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<RechazoLoteImportacionContableResult> {
    return importaciones.rechazarLoteImportacionContable(
      this.coreClientService,
      loteId,
      body,
      auth,
      correlationId,
    );
  }

  getAuditoria(
    filtro: AuditoriaFiltro,
    correlationId: string,
  ): Promise<AuditoriaPaginaResult> {
    return auditoria.getAuditoria(
      this.coreClientService,
      filtro,
      correlationId,
    );
  }

  getAreas(
    organizacionId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<AreasPaginaResult> {
    return estructura.getAreas(
      this.coreClientService,
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
    return estructura.altaArea(
      this.coreClientService,
      body,
      auth,
      correlationId,
    );
  }

  actualizarArea(
    areaId: string,
    body: ActualizarAreaBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<AreaResult> {
    return estructura.actualizarArea(
      this.coreClientService,
      areaId,
      body,
      auth,
      correlationId,
    );
  }

  getUbicaciones(
    sedeId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<UbicacionesPaginaResult> {
    return estructura.getUbicaciones(
      this.coreClientService,
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
    return estructura.altaUbicacion(
      this.coreClientService,
      body,
      auth,
      correlationId,
    );
  }

  actualizarUbicacion(
    ubicacionId: string,
    body: ActualizarUbicacionBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<UbicacionResult> {
    return estructura.actualizarUbicacion(
      this.coreClientService,
      ubicacionId,
      body,
      auth,
      correlationId,
    );
  }

  getResponsables(
    areaId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<ResponsablesPaginaResult> {
    return estructura.getResponsables(
      this.coreClientService,
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
    return estructura.altaResponsable(
      this.coreClientService,
      body,
      auth,
      correlationId,
    );
  }

  actualizarEstadoResponsable(
    responsableId: string,
    body: ActualizarEstadoResponsableBody,
    auth: KeycloakAuthContext,
    correlationId: string,
  ): Promise<ResponsableResult> {
    return estructura.actualizarEstadoResponsable(
      this.coreClientService,
      responsableId,
      body,
      auth,
      correlationId,
    );
  }
}
