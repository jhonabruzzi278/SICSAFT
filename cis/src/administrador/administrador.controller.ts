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
import { AdministradorSistemaGuard } from './administrador-sistema.guard';
import { AdministradorSistemaEnCualquierOrganizacionGuard } from './administrador-sistema-cualquier-organizacion.guard';
import type { GrantUsuario } from '../keycloak-admin/keycloak-admin.types';
import {
  actualizarAreaSchema,
  actualizarCondicionesContratoSchema,
  actualizarContratoSchema,
  actualizarDescripcionActivoSchema,
  actualizarEstadoOrganizacionSchema,
  actualizarEstadoResponsableSchema,
  actualizarEstadoSedeSchema,
  actualizarUbicacionSchema,
  altaActivoSchema,
  altaAreaSchema,
  altaCatalogoTipoSchema,
  altaContratoSchema,
  altaDocumentoActivoSchema,
  altaOrganizacionSchema,
  altaResponsableSchema,
  altaSedeSchema,
  altaUbicacionSchema,
  areasQuerySchema,
  asignarUsuarioOrganizacionSchema,
  auditoriaQuerySchema,
  cambioResponsableActivoSchema,
  contratosQuerySchema,
  documentosActivoQuerySchema,
  editarOrganizacionSchema,
  escrituraOficialActivoSchema,
  importacionContableSchema,
  crearLoteImportacionContableSchema,
  listarLotesImportacionContableQuerySchema,
  aprobarLoteImportacionContableSchema,
  rechazarLoteImportacionContableSchema,
  quitarRolUsuarioOrganizacionSchema,
  responsablesQuerySchema,
  sedesQuerySchema,
  ubicacionesQuerySchema,
} from './administrador.schemas';
import type {
  ActualizarAreaBody,
  ActualizarCondicionesContratoBody,
  ActualizarContratoBody,
  ActualizarDescripcionActivoBody,
  ActualizarEstadoOrganizacionBody,
  ActualizarEstadoResponsableBody,
  ActualizarEstadoSedeBody,
  ActualizarUbicacionBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaCatalogoTipoBody,
  AltaContratoBody,
  AltaDocumentoActivoBody,
  AltaOrganizacionBody,
  AltaResponsableBody,
  AltaSedeBody,
  AltaUbicacionBody,
  AreasQuery,
  AsignarUsuarioOrganizacionBody,
  AuditoriaQuery,
  CambioResponsableActivoBody,
  ContratosQuery,
  DocumentosActivoQuery,
  EditarOrganizacionBody,
  EscrituraOficialActivoBody,
  ImportacionContableBody,
  CrearLoteImportacionContableBody,
  ListarLotesImportacionContableQuery,
  AprobarLoteImportacionContableBody,
  RechazarLoteImportacionContableBody,
  QuitarRolUsuarioOrganizacionBody,
  ResponsablesQuery,
  SedesQuery,
  UbicacionesQuery,
} from './administrador.schemas';
import type {
  ActivoResult,
  AreasPaginaResult,
  AuditoriaPaginaResult,
  AreaResult,
  CatalogoTipoResult,
  ContratoResult,
  ContratosPaginaResult,
  DocumentoActivoResult,
  ImportacionContableResult,
  CrearLoteImportacionContableResult,
  LoteImportacionContableResult,
  LoteConFilasImportacionContableResult,
  RechazoLoteImportacionContableResult,
  IndicadoresResult,
  OrganizacionResult,
  ResponsableResult,
  ResponsablesPaginaResult,
  SedeResult,
  UbicacionResult,
  UbicacionesPaginaResult,
} from '../core-client/core-client.types';

// DOC-012 5 (Fase 5) — endpoints de escritura oficial para WEB (Administrador Patrimonial).
// Mismos guards que QrConnectorController (KeycloakAuthGuard autentica al operador real, luego
// RateLimitGuard por operador) — WEB y APP QR son clientes intercambiables del mismo mecanismo
// de auth (ARQUITECTURA-WAF.md 8), la autorizacion de ROL la re-verifica CORE (WAF 3, cero
// confianza entre niveles) — este controller no decide "puede escribir", solo transporta.
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

  // DOC-021 3 (gap "estados") — pipe por parametro (mismo motivo que actualizarEstadoContrato).
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

  // DOC-021 4 (gap "familias/categorías") — lectura abierta, mismo criterio que getContratos.
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

  // DOC-021 4 (Administrador del Sistema) — lectura abierta, mismo criterio que getContratos.
  @Get('organizaciones')
  getOrganizaciones(
    @Req() request: RequestWithCorrelationId,
  ): Promise<OrganizacionResult[]> {
    return this.administradorService.getOrganizaciones(request.correlationId);
  }

  @Post('organizaciones')
  @UsePipes(new ZodValidationPipe(altaOrganizacionSchema))
  altaOrganizacion(
    @Body() body: AltaOrganizacionBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<OrganizacionResult> {
    return this.administradorService.altaOrganizacion(
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-024 1 — editar nombre. Sin guard explicito: la autorizacion se resuelve dentro de
  // OrquestadorService (mismo motivo que altaOrganizacion).
  @Patch('organizaciones/:orgId')
  editarOrganizacion(
    @Param('orgId') orgId: string,
    @Body(new ZodValidationPipe(editarOrganizacionSchema))
    body: EditarOrganizacionBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<OrganizacionResult> {
    return this.administradorService.editarOrganizacion(
      orgId,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-024 1 — dar de baja/reactivar. Bidireccional, sin cascada a Contrato (DOC-024 1).
  @Patch('organizaciones/:orgId/estado')
  actualizarEstadoOrganizacion(
    @Param('orgId') orgId: string,
    @Body(new ZodValidationPipe(actualizarEstadoOrganizacionSchema))
    body: ActualizarEstadoOrganizacionBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<OrganizacionResult> {
    return this.administradorService.actualizarEstadoOrganizacion(
      orgId,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-023 3 — hallazgo corregido: antes era lectura abierta sin auditoria (CORE tampoco la
  // exige, ver indicadores.controller.ts de CORE) y sin guard de rol en backend, solo ocultada en
  // la UI de web_admin. Sin organizacionId propio (son indicadores agregados de toda la
  // plataforma), asi que el chequeo correcto es "el rol en cualquier organizacion", no el patron
  // AdministradorSistemaGuard de :orgId que usa el resto de este controller.
  @Get('indicadores')
  @UseGuards(AdministradorSistemaEnCualquierOrganizacionGuard)
  getIndicadores(
    @Req() request: RequestWithCorrelationId,
  ): Promise<IndicadoresResult> {
    return this.administradorService.getIndicadores(request.correlationId);
  }

  // DOC-021 4 — asignar usuarios a organizaciones (integración real con Zitadel). A diferencia
  // del resto de este controller, acá SÍ hace falta un guard explícito (AdministradorSistemaGuard,
  // ver ese archivo para por qué no sigue el patrón "verificar dentro del Orquestador" del resto)
  // — esto nunca pasa por CORE, así que no hay otro punto donde autorizar.
  @Get('organizaciones/:orgId/usuarios')
  @UseGuards(AdministradorSistemaGuard)
  getUsuariosOrganizacion(
    @Param('orgId') orgId: string,
    @Req() request: RequestWithCorrelationId,
  ): Promise<GrantUsuario[]> {
    return this.administradorService.listarUsuariosOrganizacion(
      orgId,
      request.correlationId,
    );
  }

  // Pipe por parametro, no @UsePipes de metodo (mismo motivo que actualizarEstadoContrato mas
  // arriba: @UsePipes valida TAMBIEN @Param('orgId'), un string, contra un schema que espera un
  // objeto — bug real ya encontrado una vez en este mismo archivo, DOC-012 5).
  @Post('organizaciones/:orgId/usuarios')
  @UseGuards(AdministradorSistemaGuard)
  asignarUsuarioOrganizacion(
    @Param('orgId') orgId: string,
    @Body(new ZodValidationPipe(asignarUsuarioOrganizacionSchema))
    body: AsignarUsuarioOrganizacionBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<void> {
    return this.administradorService.asignarUsuarioOrganizacion(
      orgId,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-024 — inverso de asignarUsuarioOrganizacion. Mismo guard, mismo motivo de pipe por
  // parametro (evita validar @Param('userId') contra un schema de objeto).
  @Delete('organizaciones/:orgId/usuarios/:userId')
  @UseGuards(AdministradorSistemaGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  quitarRolUsuarioOrganizacion(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(quitarRolUsuarioOrganizacionSchema))
    body: QuitarRolUsuarioOrganizacionBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<void> {
    return this.administradorService.quitarRolUsuarioOrganizacion(
      orgId,
      userId,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-024 — dar de baja a un usuario en el proveedor de identidad (nunca borrar, ver
  // KeycloakAdminService.desactivarUsuario). Mismo guard que el resto de este sub-recurso.
  @Post('organizaciones/:orgId/usuarios/:userId/desactivar')
  @UseGuards(AdministradorSistemaGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  desactivarUsuarioOrganizacion(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<void> {
    return this.administradorService.desactivarUsuarioOrganizacion(
      orgId,
      userId,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // Paginado (RNF-01, cierra el gap).
  @Get('contratos')
  getContratos(
    @Query(new ZodValidationPipe(contratosQuerySchema)) query: ContratosQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<ContratosPaginaResult> {
    return this.administradorService.getContratos(query, request.correlationId);
  }

  @Post('contratos')
  @UsePipes(new ZodValidationPipe(altaContratoSchema))
  altaContrato(
    @Body() body: AltaContratoBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ContratoResult> {
    return this.administradorService.altaContrato(
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // RF-06 (Fase 5) — lectura abierta, mismo criterio que getContratos. Filtros opcionales por
  // usuario/operacion/fecha (cierra el gap: el requisito pedia "filtrable", el primer incremento
  // no tenia ningun filtro).
  @Get('auditoria')
  getAuditoria(
    @Query(new ZodValidationPipe(auditoriaQuerySchema)) query: AuditoriaQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<AuditoriaPaginaResult> {
    return this.administradorService.getAuditoria(query, request.correlationId);
  }

  // Pipe a nivel de parámetro (no @UsePipes de método) — @UsePipes valida TODOS los parámetros
  // del método, incluido @Param('id') (un string), contra un schema que espera un objeto.
  @Patch('contratos/:id')
  actualizarEstadoContrato(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarContratoSchema))
    body: ActualizarContratoBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ContratoResult> {
    return this.administradorService.actualizarEstadoContrato(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-024 2 — editar condiciones (vigencia/modulos/sedes). Endpoint separado de
  // actualizarEstadoContrato (que solo cambia `estado`) — ver DOC-024 2.
  @Patch('contratos/:id/condiciones')
  actualizarCondicionesContrato(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarCondicionesContratoSchema))
    body: ActualizarCondicionesContratoBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<ContratoResult> {
    return this.administradorService.actualizarCondicionesContrato(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // Gap 2 (flujo real Admin->Directivo->Profesional AFT) — cierra el gap "no hay ABM de Sede".
  @Post('sedes')
  @UsePipes(new ZodValidationPipe(altaSedeSchema))
  altaSede(
    @Body() body: AltaSedeBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<SedeResult> {
    return this.administradorService.altaSede(
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // DOC-024 1 — el picker que reemplaza copiar/pegar un id a mano en el formulario de Contrato
  // de web_admin. Lectura abierta, mismo criterio que getOrganizaciones.
  @Get('sedes')
  getSedes(
    @Query(new ZodValidationPipe(sedesQuerySchema)) query: SedesQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<SedeResult[]> {
    return this.administradorService.getSedes(
      query.organizacionId,
      request.correlationId,
    );
  }

  // DOC-024 1 — dar de baja/reactivar. Sin guard explicito: la autorizacion se resuelve dentro de
  // OrquestadorService (mismo motivo que altaSede).
  @Patch('sedes/:id/estado')
  actualizarEstadoSede(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarEstadoSedeSchema))
    body: ActualizarEstadoSedeBody,
    @Req() request: AuthenticatedRequest & RequestWithCorrelationId,
  ): Promise<SedeResult> {
    return this.administradorService.actualizarEstadoSede(
      id,
      body,
      requireAuthContext(request),
      request.correlationId,
    );
  }

  // RF-05 (Fase 5) — lectura abierta, mismo criterio que getContratos.
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
  // actualizarEstadoContrato de mas arriba).
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

  // Pipe por parametro (mismo motivo que actualizarEstadoContrato de mas arriba).
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
