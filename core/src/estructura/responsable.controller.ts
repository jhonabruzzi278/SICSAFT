import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ResponsableRepository } from './responsable.repository';
import { responsablesQuerySchema } from './estructura.schemas';
import type { ResponsablesQuery } from './estructura.schemas';
import type { Responsable } from './responsable.types';

// RF-05 (Fase 5, WEB) — lectura abierta, mismo criterio que ContratoController.getContratos.
@Controller()
@UseGuards(ServiceTokenGuard)
export class ResponsableController {
  constructor(private readonly responsableRepository: ResponsableRepository) {}

  @Get('responsables')
  getResponsables(
    @Query(new ZodValidationPipe(responsablesQuerySchema)) query: ResponsablesQuery,
  ): Promise<Responsable[]> {
    return this.responsableRepository.findByArea(query.areaId);
  }
}
