import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AreaRepository } from './area.repository';
import { areasQuerySchema } from './estructura.schemas';
import type { AreasQuery } from './estructura.schemas';
import type { Area } from './area.types';

// RF-05 (Fase 5, WEB) — lectura abierta, mismo criterio que ContratoController.getContratos.
@Controller()
@UseGuards(ServiceTokenGuard)
export class AreaController {
  constructor(private readonly areaRepository: AreaRepository) {}

  @Get('areas')
  getAreas(
    @Query(new ZodValidationPipe(areasQuerySchema)) query: AreasQuery,
  ): Promise<Area[]> {
    return this.areaRepository.findByOrganizacion(query.organizacionId);
  }
}
