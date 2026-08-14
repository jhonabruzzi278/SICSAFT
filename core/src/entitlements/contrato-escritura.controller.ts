import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OrquestadorService } from '../orquestador/orquestador.service';
import {
  actualizarContratoSchema,
  altaContratoSchema,
} from './contrato.schemas';
import type {
  ActualizarContratoBody,
  AltaContratoBody,
} from './contrato.schemas';
import type { Contrato } from './contrato.types';

// DOC-012 §7 — escritura oficial de Contrato (alta/cambio de estado). Solo ServiceTokenGuard
// acá: la autorizacion de rol se resuelve dentro de OrquestadorService, mismo motivo que
// ActivoEscrituraController (DOC-012 §8, un 403 por falta de rol queda auditado).
@Controller('contratos')
@UseGuards(ServiceTokenGuard)
export class ContratoEscrituraController {
  constructor(private readonly orquestadorService: OrquestadorService) {}

  @Post()
  alta(
    @Body(new ZodValidationPipe(altaContratoSchema)) body: AltaContratoBody,
  ): Promise<Contrato> {
    return this.orquestadorService.procesarAltaContrato(body);
  }

  @Patch(':id')
  actualizarEstado(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarContratoSchema))
    body: ActualizarContratoBody,
  ): Promise<Contrato> {
    return this.orquestadorService.procesarActualizacionContrato(id, body);
  }
}
