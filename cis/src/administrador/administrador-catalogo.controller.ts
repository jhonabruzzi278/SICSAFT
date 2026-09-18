import {
  Body,
  Controller,
  Get,
  Post,
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
import { altaCatalogoTipoSchema } from './administrador.schemas';
import type { AltaCatalogoTipoBody } from './administrador.schemas';
import type { CatalogoTipoResult } from '../core-client/core-client.types';

// DOC-021 4 (gap "familias/categorías" del catálogo de tipos de activo).
@Controller('admin')
@UseGuards(KeycloakAuthGuard, RateLimitGuard)
export class CatalogoAdminController {
  constructor(private readonly administradorService: AdministradorService) {}

  // Lectura abierta, mismo criterio que getAuditoria.
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
}
