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
  actualizarCondicionesContratoSchema,
  actualizarContratoSchema,
  altaContratoSchema,
} from './contrato.schemas';
import type {
  ActualizarCondicionesContratoBody,
  ActualizarContratoBody,
  AltaContratoBody,
} from './contrato.schemas';
import type { Contrato } from './contrato.types';

// DOC-012 7 — escritura oficial de Contrato (alta/cambio de estado). Solo ServiceTokenGuard
// acá: la autorizacion de rol se resuelve dentro de OrquestadorService, mismo motivo que
// ActivoEscrituraController (DOC-012 8, un 403 por falta de rol queda auditado). DOC-024 2 agrega
// `PATCH :id/condiciones`, endpoint separado de `PATCH :id` (que solo cambia `estado`) — ver
// DOC-024 2.
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

  @Patch(':id/condiciones')
  actualizarCondiciones(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarCondicionesContratoSchema))
    body: ActualizarCondicionesContratoBody,
  ): Promise<Contrato> {
    return this.orquestadorService.procesarActualizarCondicionesContrato(
      id,
      body,
    );
  }
}
