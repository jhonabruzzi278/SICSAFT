import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
  actualizarContratoSchema,
  altaActivoSchema,
  altaContratoSchema,
} from './administrador.schemas';
import type {
  ActualizarContratoBody,
  AltaActivoBody,
  AltaContratoBody,
} from './administrador.schemas';
import type {
  ActivoResult,
  ContratoResult,
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

  @Get('contratos')
  getContratos(
    @Req() request: RequestWithCorrelationId,
  ): Promise<ContratoResult[]> {
    return this.administradorService.getContratos(request.correlationId);
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
}
