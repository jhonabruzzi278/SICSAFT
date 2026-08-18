import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrquestadorService } from '../orquestador/orquestador.service';
import { importacionContableSchema } from './importacion-contable.schemas';
import type { ImportacionContableBody } from './importacion-contable.schemas';
import type { ImportacionContableResultado } from './importacion-contable.types';

// DOC-012 6 — importacion masiva de base contable. Solo ServiceTokenGuard acá, mismo motivo que
// ActivoEscrituraController: la autorizacion de rol se resuelve dentro de OrquestadorService para
// que un 403 por falta de rol quede auditado (DOC-012 8).
@Controller('importaciones')
@UseGuards(ServiceTokenGuard)
export class ImportacionContableController {
  constructor(private readonly orquestadorService: OrquestadorService) {}

  @Post('contable')
  @HttpCode(HttpStatus.OK)
  importar(
    @Body(new ZodValidationPipe(importacionContableSchema))
    body: ImportacionContableBody,
  ): Promise<ImportacionContableResultado> {
    return this.orquestadorService.procesarImportacionContable(body);
  }
}
