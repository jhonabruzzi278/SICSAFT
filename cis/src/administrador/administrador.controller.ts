import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  KeycloakAuthGuard,
  requireAuthContext,
  type AuthenticatedRequest,
} from '../common/auth/keycloak-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import { AdministradorService } from './administrador.service';
import {
  actualizarAreaSchema,
  actualizarDescripcionActivoSchema,
  actualizarEstadoResponsableSchema,
  actualizarUbicacionSchema,
  altaActivoSchema,
  altaAreaSchema,
  altaCatalogoTipoSchema,
  altaDocumentoActivoSchema,
  altaResponsableSchema,
  altaUbicacionSchema,
  areasQuerySchema,
  auditoriaQuerySchema,
  cambioResponsableActivoSchema,
  documentosActivoQuerySchema,
  escrituraOficialActivoSchema,
  importacionContableSchema,
  crearLoteImportacionContableSchema,
  listarLotesImportacionContableQuerySchema,
  aprobarLoteImportacionContableSchema,
  rechazarLoteImportacionContableSchema,
  responsablesQuerySchema,
  ubicacionesQuerySchema,
} from './administrador.schemas';
import type {
  ActualizarAreaBody,
  ActualizarDescripcionActivoBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaCatalogoTipoBody,
  AltaDocumentoActivoBody,
  AltaResponsableBody,
  AltaUbicacionBody,
  AreasQuery,
  AuditoriaQuery,
  CambioResponsableActivoBody,
  DocumentosActivoQuery,
  EscrituraOficialActivoBody,
  ImportacionContableBody,
  CrearLoteImportacionContableBody,
  ListarLotesImportacionContableQuery,
  AprobarLoteImportacionContableBody,
  RechazarLoteImportacionContableBody,
  ResponsablesQuery,
  UbicacionesQuery,
} from './administrador.schemas';
import type {
  ActivoResult,
  AreasPaginaResult,
  AuditoriaPaginaResult,
  AreaResult,
  CatalogoTipoResult,
  DocumentoActivoResult,
  ImportacionContableResult,
  CrearLoteImportacionContableResult,
  LoteImportacionContableResult,
  LoteConFilasImportacionContableResult,
  RechazoLoteImportacionContableResult,
  ResponsableResult,
  ResponsablesPaginaResult,
  UbicacionResult,
  UbicacionesPaginaResult,
} from '../core-client/core-client.types';

// DOC-012 5 (Fase 5) — endpoints de escritura oficial para el CCP (Administrador Patrimonial /
// Profesional de AFT). Mismos guards que QrConnectorController (KeycloakAuthGuard autentica al
// operador real, luego RateLimitGuard por operador) — WEB y APP QR son clientes intercambiables
// del mismo mecanismo de auth (ARQUITECTURA-WAF.md 8), la autorizacion de ROL la re-verifica CORE
// (WAF 3, cero confianza entre niveles) — este controller no decide "puede escribir", solo
// transporta.
//
// Alcance: activos (alta/baja/responsable/descripcion), catalogo de tipos, documentos, ingesta
// contable supervisada (RF-B), auditoria, y estructura (areas/ubicaciones/responsables). Las
// rutas de Organizacion/Contrato/Sede/usuarios/indicadores se retiraron al eliminar el portal
// del Administrador del Sistema (2026-09): la intervencion del proveedor en el core de la
// organizacion pasa a ser directa (BD / script con service-token) + el bootstrap del wizard.
@Controller('admin')
@UseGuards(KeycloakAuthGuard, RateLimitGuard)
export class AdministradorController {
  constructor(private readonly administradorService: AdministradorService) {}

  @Post('activos')
  @UsePipes(new ZodValidationPipe(altaActivoSchema))
  altaActivo(
    @Body() body: AltaActivoBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ActivoResult> {
    return this.administradorService.altaActivo(
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-021 3 (gap "estados") — pipe por parametro (mismo motivo que actualizarEstadoResponsable).
  @Post('activos/:id/baja')
  bajaActivo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(escrituraOficialActivoSchema))
    body: EscrituraOficialActivoBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ActivoResult> {
    return this.administradorService.bajaActivo(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  @Post('activos/:id/reincorporacion')
  reincorporarActivo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(escrituraOficialActivoSchema))
    body: EscrituraOficialActivoBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ActivoResult> {
    return this.administradorService.reincorporarActivo(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  @Patch('activos/:id/responsable')
  cambiarResponsableActivo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cambioResponsableActivoSchema))
    body: CambioResponsableActivoBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ActivoResult> {
    return this.administradorService.cambiarResponsableActivo(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-021 3 (gap "descripciones").
  @Patch('activos/:id/descripcion')
  actualizarDescripcionActivo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarDescripcionActivoSchema))
    body: ActualizarDescripcionActivoBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ActivoResult> {
    return this.administradorService.actualizarDescripcionActivo(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-021 4 (gap "familias/categorías") — lectura abierta, mismo criterio que getAuditoria.
  @Get('catalogo-tipos')
  getCatalogoTipos(
    @Req() request: RequestWithCorrelationId,
  ): Promise<CatalogoTipoResult[]> {
    return this.administradorService.getCatalogoTipos(request.correlationId);
  }

  @Post('catalogo-tipos')
  @UsePipes(new ZodValidationPipe(altaCatalogoTipoSchema))
  altaCatalogoTipo(
    @Body() body: AltaCatalogoTipoBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<CatalogoTipoResult> {
    return this.administradorService.altaCatalogoTipo(
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-021 3 (gap "documentación y fotografías").
  @Get('activos/:id/documentos')
  getDocumentosActivo(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(documentosActivoQuerySchema))
    query: DocumentosActivoQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<DocumentoActivoResult[]> {
    return this.administradorService.getDocumentosActivo(
      id,
      query.organizacionId,
      request.correlationId,
    );
  }

  @Post('activos/:id/documentos')
  altaDocumentoActivo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(altaDocumentoActivoSchema))
    body: AltaDocumentoActivoBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<DocumentoActivoResult> {
    return this.administradorService.altaDocumentoActivo(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  @Delete('activos/:id/documentos/:documentoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminarDocumentoActivo(
    @Param('id') id: string,
    @Param('documentoId') documentoId: string,
    @Body(new ZodValidationPipe(escrituraOficialActivoSchema))
    body: EscrituraOficialActivoBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<void> {
    return this.administradorService.eliminarDocumentoActivo(
      id,
      documentoId,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-012 6 (gap "importaciones controladas").
  @Post('importaciones/contable')
  @UsePipes(new ZodValidationPipe(importacionContableSchema))
  importarContable(
    @Body() body: ImportacionContableBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ImportacionContableResult> {
    return this.administradorService.importarContable(
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-029 RF-B — bandeja de staging de la ingesta de Excel supervisada. crear/aprobar/rechazar
  // inyectan la identidad del JWT (CORE verifica el rol y audita); listar/obtener requieren sesión
  // válida (KeycloakAuthGuard del controller) y acotan por `organizacionId`.
  @Post('importaciones/contable/lote')
  @UsePipes(new ZodValidationPipe(crearLoteImportacionContableSchema))
  crearLoteImportacionContable(
    @Body() body: CrearLoteImportacionContableBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<CrearLoteImportacionContableResult> {
    return this.administradorService.crearLoteImportacionContable(
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  @Get('importaciones/contable/lote')
  listarLotesImportacionContable(
    @Query(new ZodValidationPipe(listarLotesImportacionContableQuerySchema))
    query: ListarLotesImportacionContableQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<LoteImportacionContableResult[]> {
    return this.administradorService.listarLotesImportacionContable(
      query.organizacionId,
      query.estado,
      request.correlationId,
    );
  }

  @Get('importaciones/contable/lote/:id')
  obtenerLoteImportacionContable(
    @Param('id') id: string,
    @Req() request: RequestWithCorrelationId,
  ): Promise<LoteConFilasImportacionContableResult> {
    return this.administradorService.obtenerLoteImportacionContable(
      id,
      request.correlationId,
    );
  }

  @Post('importaciones/contable/lote/:id/aprobar')
  @HttpCode(HttpStatus.OK)
  aprobarLoteImportacionContable(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(aprobarLoteImportacionContableSchema))
    body: AprobarLoteImportacionContableBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ImportacionContableResult> {
    return this.administradorService.aprobarLoteImportacionContable(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  @Post('importaciones/contable/lote/:id/rechazar')
  @HttpCode(HttpStatus.OK)
  rechazarLoteImportacionContable(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rechazarLoteImportacionContableSchema))
    body: RechazarLoteImportacionContableBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<RechazoLoteImportacionContableResult> {
    return this.administradorService.rechazarLoteImportacionContable(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // RF-06 (Fase 5) — lectura abierta. Filtros opcionales por usuario/operacion/fecha/area.
  @Get('auditoria')
  getAuditoria(
    @Query(new ZodValidationPipe(auditoriaQuerySchema)) query: AuditoriaQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<AuditoriaPaginaResult> {
    return this.administradorService.getAuditoria(query, request.correlationId);
  }

  // RF-05 (Fase 5) — lectura abierta, mismo criterio que getAuditoria.
  @Get('areas')
  getAreas(
    @Query(new ZodValidationPipe(areasQuerySchema)) query: AreasQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<AreasPaginaResult> {
    return this.administradorService.getAreas(
      query.organizacionId,
      { limit: query.limit, offset: query.offset },
      request.correlationId,
    );
  }

  @Post('areas')
  @UsePipes(new ZodValidationPipe(altaAreaSchema))
  altaArea(
    @Body() body: AltaAreaBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<AreaResult> {
    return this.administradorService.altaArea(
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // RF-05 (cierra el gap "ABM completo") — pipe por parametro (mismo motivo que
  // actualizarEstadoResponsable de mas abajo).
  @Patch('areas/:id')
  actualizarArea(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarAreaSchema)) body: ActualizarAreaBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<AreaResult> {
    return this.administradorService.actualizarArea(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  @Get('ubicaciones')
  getUbicaciones(
    @Query(new ZodValidationPipe(ubicacionesQuerySchema))
    query: UbicacionesQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<UbicacionesPaginaResult> {
    return this.administradorService.getUbicaciones(
      query.sedeId,
      { limit: query.limit, offset: query.offset },
      request.correlationId,
    );
  }

  @Post('ubicaciones')
  @UsePipes(new ZodValidationPipe(altaUbicacionSchema))
  altaUbicacion(
    @Body() body: AltaUbicacionBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<UbicacionResult> {
    return this.administradorService.altaUbicacion(
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // RF-05 (cierra el gap "ABM completo") — pipe por parametro.
  @Patch('ubicaciones/:id')
  actualizarUbicacion(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarUbicacionSchema))
    body: ActualizarUbicacionBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<UbicacionResult> {
    return this.administradorService.actualizarUbicacion(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  @Get('responsables')
  getResponsables(
    @Query(new ZodValidationPipe(responsablesQuerySchema))
    query: ResponsablesQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<ResponsablesPaginaResult> {
    return this.administradorService.getResponsables(
      query.areaId,
      { limit: query.limit, offset: query.offset },
      request.correlationId,
    );
  }

  @Post('responsables')
  @UsePipes(new ZodValidationPipe(altaResponsableSchema))
  altaResponsable(
    @Body() body: AltaResponsableBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ResponsableResult> {
    return this.administradorService.altaResponsable(
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // Pipe por parametro (mismo motivo que actualizarArea de mas arriba).
  @Patch('responsables/:id/estado')
  actualizarEstadoResponsable(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarEstadoResponsableSchema))
    body: ActualizarEstadoResponsableBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ResponsableResult> {
    return this.administradorService.actualizarEstadoResponsable(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }
}
