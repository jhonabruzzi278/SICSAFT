import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  aprobarLoteImportacionContableSchema,
  crearLoteImportacionContableSchema,
  importacionContableSchema,
  listarLotesImportacionContableQuerySchema,
  rechazarLoteImportacionContableSchema,
} from './administrador.schemas';
import type {
  AprobarLoteImportacionContableBody,
  CrearLoteImportacionContableBody,
  ImportacionContableBody,
  ListarLotesImportacionContableQuery,
  RechazarLoteImportacionContableBody,
} from './administrador.schemas';
import type {
  CrearLoteImportacionContableResult,
  ImportacionContableResult,
  LoteConFilasImportacionContableResult,
  LoteImportacionContableResult,
  RechazoLoteImportacionContableResult,
} from '../core-client/core-client.types';

// DOC-012 6 (gap "importaciones controladas") + DOC-029 RF-B (bandeja de staging de la ingesta de
// Excel supervisada). crear/aprobar/rechazar inyectan la identidad del JWT (CORE verifica el rol
// y audita); listar/obtener requieren sesión válida y acotan por `organizacionId`.
@Controller('admin')
@UseGuards(KeycloakAuthGuard, RateLimitGuard)
export class ImportacionesAdminController {
  constructor(private readonly administradorService: AdministradorService) {}

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
}
