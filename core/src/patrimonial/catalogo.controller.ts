import { Controller, Get, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ActivoRepository } from './activo.repository';
import { catalogoQuerySchema } from './catalogo.schemas';
import type { CatalogoQuery } from './catalogo.schemas';
import type { CatalogoPagina } from './activo.types';

// GET /catalogo — DOC-006 2. Consulta paginada del catálogo oficial de activos de la BPI.
@Controller()
@UseGuards(ServiceTokenGuard)
export class CatalogoController {
  constructor(private readonly activoRepository: ActivoRepository) {}

  @Get('catalogo')
  @UsePipes(new ZodValidationPipe(catalogoQuerySchema))
  getCatalogo(@Query() query: CatalogoQuery): Promise<CatalogoPagina> {
    return this.activoRepository.findCatalogo(query);
  }
}
