import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { KeycloakAuthGuard } from '../common/auth/keycloak-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import { AdministradorService } from './administrador.service';
import { auditoriaQuerySchema } from './administrador.schemas';
import type { AuditoriaQuery } from './administrador.schemas';
import type { AuditoriaPaginaResult } from '../core-client/core-client.types';

// RF-06 (Fase 5) — lectura abierta. Filtros opcionales por usuario/operacion/fecha/area.
@Controller('admin')
@UseGuards(KeycloakAuthGuard, RateLimitGuard)
export class AuditoriaAdminController {
  constructor(private readonly administradorService: AdministradorService) {}

  @Get('auditoria')
  getAuditoria(
    @Query(new ZodValidationPipe(auditoriaQuerySchema)) query: AuditoriaQuery,
    @Req() request: RequestWithCorrelationId,
  ): Promise<AuditoriaPaginaResult> {
    return this.administradorService.getAuditoria(query, request.correlationId);
  }
}
