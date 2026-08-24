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
  requireAuthContext,
  ZitadelAuthGuard,
} from '../common/auth/zitadel-auth.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import type { RequestWithCorrelationId } from '../common/correlation-id/correlation-id.middleware';
import { DirectivoService } from './directivo.service';
import {
  DirectivoGuard,
  requireDirectivoOrganizacionId,
  type DirectivoRequest,
} from './directivo.guard';
import type { GrantUsuario } from '../zitadel-admin/zitadel-admin.types';
import {
  asignarProfesionalAftSchema,
  type AsignarProfesionalAftBody,
  type AsignarProfesionalAftResult,
} from './directivo.schemas';

// DOC-022 3 — el Directivo designa quién es el Profesional de AFT de SU organización. Igual que
// AdministradorController con /organizaciones/:orgId/usuarios: esto es gestión de identidad en
// Zitadel, no escritura de BPI, así que nunca pasa por el Orquestador de CORE (ver DirectivoGuard
// para el porqué de no necesitar el patrón "verificar dentro del Orquestador" de DOC-012 8).
@Controller('directivo')
@UseGuards(ZitadelAuthGuard, RateLimitGuard, DirectivoGuard)
export class DirectivoController {
  constructor(private readonly directivoService: DirectivoService) {}

  @Get('usuarios')
  getUsuarios(
    @Req() request: DirectivoRequest & RequestWithCorrelationId,
  ): Promise<GrantUsuario[]> {
    return this.directivoService.listarUsuariosOrganizacion(
      requireDirectivoOrganizacionId(request),
      request.correlationId,
    );
  }

  @Post('usuarios')
  @UsePipes(new ZodValidationPipe(asignarProfesionalAftSchema))
  asignarProfesionalAft(
    @Body() body: AsignarProfesionalAftBody,
    @Req() request: DirectivoRequest & RequestWithCorrelationId,
  ): Promise<AsignarProfesionalAftResult> {
    return this.directivoService.asignarProfesionalAft(
      requireDirectivoOrganizacionId(request),
      body,
      requireAuthContext(request).operadorId,
      request.correlationId,
    );
  }
}
