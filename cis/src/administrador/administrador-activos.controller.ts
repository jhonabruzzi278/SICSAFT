import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
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
  actualizarDescripcionActivoSchema,
  altaActivoSchema,
  altaDocumentoActivoSchema,
  cambioResponsableActivoSchema,
  documentosActivoQuerySchema,
  escrituraOficialActivoSchema,
} from './administrador.schemas';
import type {
  ActualizarDescripcionActivoBody,
  AltaActivoBody,
  AltaDocumentoActivoBody,
  CambioResponsableActivoBody,
  DocumentosActivoQuery,
  EscrituraOficialActivoBody,
} from './administrador.schemas';
import type {
  ActivoResult,
  DocumentoActivoResult,
} from '../core-client/core-client.types';

// DOC-012 5 (Fase 5) + DOC-021 3 (gaps de ciclo de vida) — alta, baja, reincorporación, cambio de
// responsable, descripción y documentos/fotografías de un Activo. Mismos guards que el resto de
// `admin/*` (KeycloakAuthGuard autentica, RateLimitGuard limita por operador) — la autorización de
// rol la re-verifica CORE (WAF 3, cero confianza entre niveles).
@Controller('admin')
@UseGuards(KeycloakAuthGuard, RateLimitGuard)
export class ActivosAdminController {
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
}
