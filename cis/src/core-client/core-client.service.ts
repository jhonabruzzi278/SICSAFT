import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  CORE_CIRCUIT_BREAKER,
  CORE_CLIENT_CONFIG,
} from './core-client.constants';
import type { CoreClientConfig } from './core-client.config';
import { CircuitBreaker } from './circuit-breaker';
import { CoreHttpExecutor } from './core-client.http-executor';
import * as entitlements from './core-client.entitlements';
import * as catalogo from './core-client.catalogo';
import * as activos from './core-client.activos';
import * as importaciones from './core-client.importaciones';
import * as inventarios from './core-client.inventarios';
import * as auditoria from './core-client.auditoria';
import * as estructura from './core-client.estructura';
import type {
  ActivoResult,
  AreaResult,
  AreasPaginaResult,
  AuditoriaFiltro,
  AuditoriaPaginaResult,
  CatalogoResult,
  CatalogoTipoResult,
  DocumentoActivoResult,
  EntitlementsResult,
  EscrituraOficialRequest,
  ImportacionContableResult,
  InventarioEstadoResult,
  Paginacion,
  PatchActivoDescripcionRequest,
  PatchActivoResponsableRequest,
  PatchAreaRequest,
  PatchResponsableEstadoRequest,
  PatchUbicacionRequest,
  PostActivoRequest,
  PostAreaRequest,
  PostAuditoriaRequest,
  PostCatalogoTipoRequest,
  PostDocumentoActivoRequest,
  PostImportacionContableRequest,
  PostLoteImportacionContableRequest,
  AprobarLoteImportacionContableRequest,
  RechazarLoteImportacionContableRequest,
  CrearLoteImportacionContableResult,
  LoteImportacionContableResult,
  LoteConFilasImportacionContableResult,
  RechazoLoteImportacionContableResult,
  PostInventarioResult,
  PostResponsableRequest,
  PostUbicacionRequest,
  ResponsableResult,
  ResponsablesPaginaResult,
  ResumenControlResult,
  SesionDetalleResult,
  SesionResumenResult,
  UbicacionResult,
  UbicacionesPaginaResult,
} from './core-client.types';
import type {
  CatalogoQuery,
  InventarioRequest,
} from '../qr-connector/qr-connector.schemas';

// Unico punto por el que CIS le habla a CORE. La fachada solo delega — el transporte HTTP
// (retries, circuit breaker, mapeo de errores) vive en CoreHttpExecutor, y cada dominio
// (Activos, Catálogo, Importaciones, Inventarios, Auditoría, Estructura) en su propio archivo
// core-client.<dominio>.ts. Mantiene el mismo constructor y la misma API pública de siempre para
// no romper a quien ya inyecta CoreClientService (administrador.controller.ts, qr-connector,
// etc.) ni la suite de tests existente.
@Injectable()
export class CoreClientService {
  private readonly http: CoreHttpExecutor;

  constructor(
    @Inject(CORE_CLIENT_CONFIG) config: CoreClientConfig,
    @Inject(CORE_CIRCUIT_BREAKER) breaker: CircuitBreaker,
    httpService: HttpService,
  ) {
    this.http = new CoreHttpExecutor(config, breaker, httpService);
  }

  getEntitlements(
    operadorId: string,
    correlationId: string,
  ): Promise<EntitlementsResult> {
    return entitlements.getEntitlements(this.http, operadorId, correlationId);
  }

  getCatalogo(
    query: CatalogoQuery,
    correlationId: string,
  ): Promise<CatalogoResult> {
    return catalogo.getCatalogo(this.http, query, correlationId);
  }

  getCatalogoTipos(correlationId: string): Promise<CatalogoTipoResult[]> {
    return catalogo.getCatalogoTipos(this.http, correlationId);
  }

  postCatalogoTipo(
    request: PostCatalogoTipoRequest,
    correlationId: string,
  ): Promise<CatalogoTipoResult> {
    return catalogo.postCatalogoTipo(this.http, request, correlationId);
  }

  postActivo(
    request: PostActivoRequest,
    correlationId: string,
  ): Promise<ActivoResult> {
    return activos.postActivo(this.http, request, correlationId);
  }

  postActivoBaja(
    activoId: string,
    request: EscrituraOficialRequest,
    correlationId: string,
  ): Promise<ActivoResult> {
    return activos.postActivoBaja(this.http, activoId, request, correlationId);
  }

  postActivoReincorporacion(
    activoId: string,
    request: EscrituraOficialRequest,
    correlationId: string,
  ): Promise<ActivoResult> {
    return activos.postActivoReincorporacion(
      this.http,
      activoId,
      request,
      correlationId,
    );
  }

  patchActivoResponsable(
    activoId: string,
    request: PatchActivoResponsableRequest,
    correlationId: string,
  ): Promise<ActivoResult> {
    return activos.patchActivoResponsable(
      this.http,
      activoId,
      request,
      correlationId,
    );
  }

  patchActivoDescripcion(
    activoId: string,
    request: PatchActivoDescripcionRequest,
    correlationId: string,
  ): Promise<ActivoResult> {
    return activos.patchActivoDescripcion(
      this.http,
      activoId,
      request,
      correlationId,
    );
  }

  getDocumentosActivo(
    activoId: string,
    organizacionId: string,
    correlationId: string,
  ): Promise<DocumentoActivoResult[]> {
    return activos.getDocumentosActivo(
      this.http,
      activoId,
      organizacionId,
      correlationId,
    );
  }

  postDocumentoActivo(
    activoId: string,
    request: PostDocumentoActivoRequest,
    correlationId: string,
  ): Promise<DocumentoActivoResult> {
    return activos.postDocumentoActivo(
      this.http,
      activoId,
      request,
      correlationId,
    );
  }

  deleteDocumentoActivo(
    activoId: string,
    documentoId: string,
    request: EscrituraOficialRequest,
    correlationId: string,
  ): Promise<void> {
    return activos.deleteDocumentoActivo(
      this.http,
      activoId,
      documentoId,
      request,
      correlationId,
    );
  }

  postImportacionContable(
    request: PostImportacionContableRequest,
    correlationId: string,
  ): Promise<ImportacionContableResult> {
    return importaciones.postImportacionContable(
      this.http,
      request,
      correlationId,
    );
  }

  postLoteImportacionContable(
    request: PostLoteImportacionContableRequest,
    correlationId: string,
  ): Promise<CrearLoteImportacionContableResult> {
    return importaciones.postLoteImportacionContable(
      this.http,
      request,
      correlationId,
    );
  }

  getLotesImportacionContable(
    organizacionId: string,
    estado: string | undefined,
    correlationId: string,
  ): Promise<LoteImportacionContableResult[]> {
    return importaciones.getLotesImportacionContable(
      this.http,
      organizacionId,
      estado,
      correlationId,
    );
  }

  getLoteImportacionContable(
    loteId: string,
    correlationId: string,
  ): Promise<LoteConFilasImportacionContableResult> {
    return importaciones.getLoteImportacionContable(
      this.http,
      loteId,
      correlationId,
    );
  }

  postAprobarLoteImportacionContable(
    loteId: string,
    request: AprobarLoteImportacionContableRequest,
    correlationId: string,
  ): Promise<ImportacionContableResult> {
    return importaciones.postAprobarLoteImportacionContable(
      this.http,
      loteId,
      request,
      correlationId,
    );
  }

  postRechazarLoteImportacionContable(
    loteId: string,
    request: RechazarLoteImportacionContableRequest,
    correlationId: string,
  ): Promise<RechazoLoteImportacionContableResult> {
    return importaciones.postRechazarLoteImportacionContable(
      this.http,
      loteId,
      request,
      correlationId,
    );
  }

  postInventario(
    request: InventarioRequest,
    correlationId: string,
  ): Promise<PostInventarioResult> {
    return inventarios.postInventario(this.http, request, correlationId);
  }

  getInventarioEstado(
    inventarioId: string,
    correlationId: string,
  ): Promise<InventarioEstadoResult> {
    return inventarios.getInventarioEstado(
      this.http,
      inventarioId,
      correlationId,
    );
  }

  getInventarios(
    organizacionId: string,
    correlationId: string,
  ): Promise<SesionResumenResult[]> {
    return inventarios.getInventarios(this.http, organizacionId, correlationId);
  }

  getInventarioDetalle(
    inventarioId: string,
    correlationId: string,
  ): Promise<SesionDetalleResult> {
    return inventarios.getInventarioDetalle(
      this.http,
      inventarioId,
      correlationId,
    );
  }

  getInventarioResumenControl(
    inventarioId: string,
    correlationId: string,
  ): Promise<ResumenControlResult> {
    return inventarios.getInventarioResumenControl(
      this.http,
      inventarioId,
      correlationId,
    );
  }

  getAuditoria(
    filtro: AuditoriaFiltro,
    correlationId: string,
  ): Promise<AuditoriaPaginaResult> {
    return auditoria.getAuditoria(this.http, filtro, correlationId);
  }

  postAuditoria(
    request: PostAuditoriaRequest,
    correlationId: string,
  ): Promise<void> {
    return auditoria.postAuditoria(this.http, request, correlationId);
  }

  getAreas(
    organizacionId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<AreasPaginaResult> {
    return estructura.getAreas(
      this.http,
      organizacionId,
      paginacion,
      correlationId,
    );
  }

  postArea(
    request: PostAreaRequest,
    correlationId: string,
  ): Promise<AreaResult> {
    return estructura.postArea(this.http, request, correlationId);
  }

  patchArea(
    areaId: string,
    request: PatchAreaRequest,
    correlationId: string,
  ): Promise<AreaResult> {
    return estructura.patchArea(this.http, areaId, request, correlationId);
  }

  getUbicaciones(
    sedeId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<UbicacionesPaginaResult> {
    return estructura.getUbicaciones(
      this.http,
      sedeId,
      paginacion,
      correlationId,
    );
  }

  postUbicacion(
    request: PostUbicacionRequest,
    correlationId: string,
  ): Promise<UbicacionResult> {
    return estructura.postUbicacion(this.http, request, correlationId);
  }

  patchUbicacion(
    ubicacionId: string,
    request: PatchUbicacionRequest,
    correlationId: string,
  ): Promise<UbicacionResult> {
    return estructura.patchUbicacion(
      this.http,
      ubicacionId,
      request,
      correlationId,
    );
  }

  getResponsables(
    areaId: string,
    paginacion: Paginacion,
    correlationId: string,
  ): Promise<ResponsablesPaginaResult> {
    return estructura.getResponsables(
      this.http,
      areaId,
      paginacion,
      correlationId,
    );
  }

  postResponsable(
    request: PostResponsableRequest,
    correlationId: string,
  ): Promise<ResponsableResult> {
    return estructura.postResponsable(this.http, request, correlationId);
  }

  patchResponsableEstado(
    responsableId: string,
    request: PatchResponsableEstadoRequest,
    correlationId: string,
  ): Promise<ResponsableResult> {
    return estructura.patchResponsableEstado(
      this.http,
      responsableId,
      request,
      correlationId,
    );
  }
}
