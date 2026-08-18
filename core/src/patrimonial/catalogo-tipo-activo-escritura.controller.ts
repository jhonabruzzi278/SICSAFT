import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { altaCatalogoTipoSchema } from './catalogo-tipo-activo.schemas';
import type { AltaCatalogoTipoBody } from './catalogo-tipo-activo.schemas';
import type { CatalogoTipoActivo } from './catalogo-tipo-activo.types';

// DOC-021 4 — vive en OrquestadorModule (no en PatrimonialModule, junto al de lectura) por el
// mismo motivo que ActivoEscrituraController: necesita OrquestadorService, que a su vez necesita
// PatrimonialModule — evita el ciclo <Modulo> -> OrquestadorModule -> <Modulo>.
@Controller('catalogo-tipos')
@UseGuards(ServiceTokenGuard)
export class CatalogoTipoActivoEscrituraController {
  constructor(private readonly orquestadorService: OrquestadorService) {}

  @Post()
  crear(
    @Body(new ZodValidationPipe(altaCatalogoTipoSchema))
    body: AltaCatalogoTipoBody,
  ): Promise<CatalogoTipoActivo> {
    return this.orquestadorService.procesarAltaCatalogoTipo(body);
  }
}
