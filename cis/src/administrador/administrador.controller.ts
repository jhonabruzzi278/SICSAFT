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
  ZitadelAuthGuard,
  requireAuthContext,
  type AuthenticatedRequest,
} from '../common/auth/zitadel-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import { AdministradorService } from './administrador.service';
import {
  actualizarAreaSchema,
  actualizarContratoSchema,
  actualizarEstadoResponsableSchema,
  actualizarUbicacionSchema,
  altaActivoSchema,
  altaAreaSchema,
  altaContratoSchema,
  altaResponsableSchema,
  altaUbicacionSchema,
  areasQuerySchema,
  auditoriaQuerySchema,
  contratosQuerySchema,
  responsablesQuerySchema,
  ubicacionesQuerySchema,
} from './administrador.schemas';
import type {
  ActualizarAreaBody,
  ActualizarContratoBody,
  ActualizarEstadoResponsableBody,
  ActualizarUbicacionBody,
  AltaActivoBody,
  AltaAreaBody,
  AltaContratoBody,
  AltaResponsableBody,
  AltaUbicacionBody,
  AreasQuery,
  AuditoriaQuery,
  ContratosQuery,
  ResponsablesQuery,
  UbicacionesQuery,
} from './administrador.schemas';
import type {
  ActivoResult,
  AreasPaginaResult,
  AuditoriaPaginaResult,
  AreaResult,
  ContratoResult,
  ContratosPaginaResult,
  ResponsableResult,
  ResponsablesPaginaResult,
  UbicacionResult,
  UbicacionesPaginaResult,
} from '../core-client/core-client.types';

// DOC-012 §5 (Fase 5) — endpoints de escritura oficial para WEB (Administrador Patrimonial).
// Mismos guards que QrConnectorController (ZitadelAuthGuard autentica al operador real, luego
// RateLimitGuard por operador) — WEB y APP QR son clientes intercambiables del mismo mecanismo
// de auth (ARQUITECTURA-WAF.md §8), la autorizacion de ROL la re-verifica CORE (WAF §3, cero
// confianza entre niveles) — este controller no decide "puede escribir", solo transporta.
@Controller('admin')
@UseGuards(ZitadelAuthGuard, RateLimitGuard)
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
