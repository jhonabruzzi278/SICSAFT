import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EntitlementsService } from './entitlements.service';
import { entitlementsQuerySchema } from './entitlements.schemas';
import type { EntitlementsQuery } from './entitlements.schemas';
import type { EntitlementsResponse } from './entitlements.types';

// GET /entitlements — ver base-patrimonial/DOC-004-modelo-contrato.md §6. Sin auth
// servicio-a-servicio todavia (CORE no valida quien lo llama, ver core/README.md "Depende de") —
// esto solo lo debe llamar CIS dentro de la red de contenedores, nunca queda expuesto por
// Traefik (ver devops/local/docker-compose.yml).
@Controller()
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get('entitlements')
  @UsePipes(new ZodValidationPipe(entitlementsQuerySchema))
  getEntitlements(@Query() query: EntitlementsQuery): EntitlementsResponse {
    return this.entitlementsService.resolve(query.operadorId);
  }
}
