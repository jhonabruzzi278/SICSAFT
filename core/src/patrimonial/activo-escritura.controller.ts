import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrquestadorService } from '../orquestador/orquestador.service';
import {
  altaActivoSchema,
  cambioResponsableSchema,
  escrituraOficialSchema,
} from './activo.schemas';
import type {
  AltaActivoBody,
  CambioResponsableBody,
  EscrituraOficialBody,
} from './activo.schemas';
import type { Activo } from './activo.types';

// DOC-012 5 — escritura oficial de Activo (alta/baja/reincorporacion/cambio de responsable).
// Solo ServiceTokenGuard acá: la autorizacion de rol (AdministradorPatrimonialGuard) se resuelve
// dentro de OrquestadorService, no como @UseGuards(), para que un 403 por falta de rol tambien
// quede auditado (DOC-012 8) en vez de cortar antes de llegar al Orquestador.
@Controller('activos')
@UseGuards(ServiceTokenGuard)
export class ActivoEscrituraController {
  constructor(private readonly orquestadorService: OrquestadorService) {}

  @Post()
  alta(
    @Body(new ZodValidationPipe(altaActivoSchema)) body: AltaActivoBody,
  ): Promise<Activo> {
    return this.orquestadorService.procesarAltaActivo(body);
  }

  @Post(':id/baja')
  @HttpCode(HttpStatus.OK)
  baja(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(escrituraOficialSchema))
    body: EscrituraOficialBody,
  ): Promise<Activo> {
    return this.orquestadorService.procesarBajaActivo(id, body);
  }

  @Post(':id/reincorporacion')
  @HttpCode(HttpStatus.OK)
  reincorporacion(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(escrituraOficialSchema))
    body: EscrituraOficialBody,
  ): Promise<Activo> {
    return this.orquestadorService.procesarReincorporacionActivo(id, body);
  }

  @Patch(':id/responsable')
  cambioResponsable(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cambioResponsableSchema))
    body: CambioResponsableBody,
  ): Promise<Activo> {
    return this.orquestadorService.procesarCambioResponsable(id, body);
  }
}
