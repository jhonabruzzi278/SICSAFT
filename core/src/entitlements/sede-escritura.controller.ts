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
import { actualizarEstadoSedeSchema, altaSedeSchema } from './sede.schemas';
import type { ActualizarEstadoSedeBody, AltaSedeBody } from './sede.schemas';
import type { Sede } from './sede.types';

// Gap 2 (flujo real Admin->Directivo->Profesional AFT) — solo ServiceTokenGuard acá: la
// autorizacion de rol se resuelve dentro de OrquestadorService, mismo motivo que
// ContratoEscrituraController (DOC-012 8, un 403 por falta de rol queda auditado). DOC-024 1
// agrega dar de baja/reactivar, mismo patron.
@Controller('sedes')
@UseGuards(ServiceTokenGuard)
export class SedeEscrituraController {
  constructor(private readonly orquestadorService: OrquestadorService) {}

  @Post()
  alta(
    @Body(new ZodValidationPipe(altaSedeSchema)) body: AltaSedeBody,
  ): Promise<Sede> {
    return this.orquestadorService.procesarAltaSede(body);
  }

  @Patch(':id/estado')
  actualizarEstado(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarEstadoSedeSchema))
    body: ActualizarEstadoSedeBody,
  ): Promise<Sede> {
    return this.orquestadorService.procesarActualizarEstadoSede(id, body);
  }
}
