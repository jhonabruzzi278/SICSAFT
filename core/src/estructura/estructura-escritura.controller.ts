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
  altaAreaSchema,
  altaResponsableSchema,
  altaUbicacionSchema,
  actualizarEstadoResponsableSchema,
} from './estructura.schemas';
import type {
  AltaAreaBody,
  AltaResponsableBody,
  AltaUbicacionBody,
  ActualizarEstadoResponsableBody,
} from './estructura.schemas';
import type { Area } from './area.types';
import type { Ubicacion } from './ubicacion.types';
import type { Responsable } from './responsable.types';

// RF-05 (Fase 5) — escritura oficial de Area/Ubicacion/Responsable, mismo criterio que
// ActivoEscrituraController: solo ServiceTokenGuard acá, la autorizacion de rol
// (verificarRolAdministradorPatrimonial) se resuelve dentro de OrquestadorService, para que un
// 403 por falta de rol tambien quede auditado (DOC-012 §8).
@Controller()
@UseGuards(ServiceTokenGuard)
export class EstructuraEscrituraController {
  constructor(private readonly orquestadorService: OrquestadorService) {}

  @Post('areas')
  altaArea(
    @Body(new ZodValidationPipe(altaAreaSchema)) body: AltaAreaBody,
  ): Promise<Area> {
    return this.orquestadorService.procesarAltaArea(body);
  }

  @Post('ubicaciones')
  altaUbicacion(
    @Body(new ZodValidationPipe(altaUbicacionSchema)) body: AltaUbicacionBody,
  ): Promise<Ubicacion> {
    return this.orquestadorService.procesarAltaUbicacion(body);
  }

  @Post('responsables')
  altaResponsable(
    @Body(new ZodValidationPipe(altaResponsableSchema))
    body: AltaResponsableBody,
  ): Promise<Responsable> {
    return this.orquestadorService.procesarAltaResponsable(body);
  }

  @Patch('responsables/:id/estado')
  actualizarEstadoResponsable(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarEstadoResponsableSchema))
    body: ActualizarEstadoResponsableBody,
  ): Promise<Responsable> {
    return this.orquestadorService.procesarActualizarEstadoResponsable(id, body);
  }
}
