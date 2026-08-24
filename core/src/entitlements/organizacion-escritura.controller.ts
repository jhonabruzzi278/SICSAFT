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
  actualizarEstadoOrganizacionSchema,
  actualizarOrganizacionSchema,
  altaOrganizacionSchema,
} from './organizacion.schemas';
import type {
  ActualizarEstadoOrganizacionBody,
  ActualizarOrganizacionBody,
  AltaOrganizacionBody,
} from './organizacion.schemas';
import type { Organizacion } from './organizacion.types';

// DOC-021 4 — vive en OrquestadorModule, mismo motivo que ContratoEscrituraController. DOC-024 1
// agrega editar nombre/estado, mismo patron.
@Controller('organizaciones')
@UseGuards(ServiceTokenGuard)
export class OrganizacionEscrituraController {
  constructor(private readonly orquestadorService: OrquestadorService) {}

  @Post()
  crear(
    @Body(new ZodValidationPipe(altaOrganizacionSchema))
    body: AltaOrganizacionBody,
  ): Promise<Organizacion> {
    return this.orquestadorService.procesarAltaOrganizacion(body);
  }

  @Patch(':id')
  actualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarOrganizacionSchema))
    body: ActualizarOrganizacionBody,
  ): Promise<Organizacion> {
    return this.orquestadorService.procesarActualizarOrganizacion(id, body);
  }

  @Patch(':id/estado')
  actualizarEstado(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(actualizarEstadoOrganizacionSchema))
    body: ActualizarEstadoOrganizacionBody,
  ): Promise<Organizacion> {
    return this.orquestadorService.procesarActualizarEstadoOrganizacion(
      id,
      body,
    );
  }
}
