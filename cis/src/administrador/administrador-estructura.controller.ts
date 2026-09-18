import {
  Body,
  Controller,
  Get,
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
  actualizarEstadoResponsableSchema,
  actualizarUbicacionSchema,
  altaAreaSchema,
  altaResponsableSchema,
  altaUbicacionSchema,
  areasQuerySchema,
  responsablesQuerySchema,
  ubicacionesQuerySchema,
} from './administrador.schemas';
import type {
  ActualizarAreaBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  AltaAreaBody,
  AltaResponsableBody,
  AltaUbicacionBody,
  AreasQuery,
  ResponsablesQuery,
  UbicacionesQuery,
} from './administrador.schemas';
import type {
  AreaResult,
  AreasPaginaResult,
  ResponsableResult,
  ResponsablesPaginaResult,
  UbicacionResult,
  UbicacionesPaginaResult,
} from '../core-client/core-client.types';

// RF-05 (Fase 5, "cierra el gap ABM completo") — ABM de Áreas, Ubicaciones y Responsables.
@Controller('admin')
@UseGuards(KeycloakAuthGuard, RateLimitGuard)
export class EstructuraAdminController {
  constructor(private readonly administradorService: AdministradorService) {}

  // Lectura abierta, mismo criterio que getAuditoria.
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

  // Pipe por parametro (mismo motivo que actualizarEstadoResponsable de mas abajo).
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

  // Pipe por parametro.
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
