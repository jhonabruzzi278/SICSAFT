import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UbicacionRepository } from './ubicacion.repository';
import { ubicacionesQuerySchema } from './estructura.schemas';
import type { UbicacionesQuery } from './estructura.schemas';
import type { UbicacionesPagina } from './ubicacion.types';

// RF-05 (Fase 5, WEB) — lectura abierta, mismo criterio que ContratoController.getContratos.
// Paginado (RNF-01, cierra el gap).
@Controller()
@UseGuards(ServiceTokenGuard)
export class UbicacionController {
  constructor(private readonly ubicacionRepository: UbicacionRepository) {}

  @Get('ubicaciones')
  getUbicaciones(
    @Query(new ZodValidationPipe(ubicacionesQuerySchema)) query: UbicacionesQuery,
  ): Promise<UbicacionesPagina> {
    return this.ubicacionRepository.findBySede(
      query.sedeId,
      query.limit,
      query.offset,
    );
  }
}
