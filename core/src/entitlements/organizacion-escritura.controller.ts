import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { altaOrganizacionSchema } from './organizacion.schemas';
import type { AltaOrganizacionBody } from './organizacion.schemas';
import type { Organizacion } from './organizacion.types';

// DOC-021 4 — vive en OrquestadorModule, mismo motivo que ContratoEscrituraController.
@Controller('organizaciones')
@UseGuards(ServiceTokenGuard)
export class OrganizacionEscrituraController {
  constructor(private readonly orquestadorService: OrquestadorService) {}

  @Post()
  crear(
    @Body(new ZodValidationPipe(altaOrganizacionSchema))
    body: AltaOrganizacionBody,
  ): Promise<Organizacion> {
    return this.orquestadorService.procesarAltaOrganizacion(body);
  }
}
