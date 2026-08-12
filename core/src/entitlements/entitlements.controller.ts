import { Controller, Get, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { EntitlementsService } from './entitlements.service';
import { entitlementsQuerySchema } from './entitlements.schemas';
import type { EntitlementsQuery } from './entitlements.schemas';
import type { EntitlementsResponse } from './entitlements.types';

// GET /entitlements — ver base-patrimonial/DOC-004-modelo-contrato.md §6. Detras de
// ServiceTokenGuard: solo CIS (unico llamador previsto, dentro de la red de contenedores, nunca
// expuesto por Traefik) puede llamar esto, y debe probarlo con el secreto compartido — ver
// common/auth/service-token.guard.ts.
@Controller()
@UseGuards(ServiceTokenGuard)
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get('entitlements')
  @UsePipes(new ZodValidationPipe(entitlementsQuerySchema))
  getEntitlements(@Query() query: EntitlementsQuery): EntitlementsResponse {
    return this.entitlementsService.resolve(query.operadorId);
  }
}
