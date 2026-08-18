import { Controller, Get, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { IndicadoresRepository } from './indicadores.repository';
import type { Indicadores } from './indicadores.types';

// DOC-021 4 — lectura abierta (mismo criterio que el resto de endpoints GET de este ecosistema);
// la restriccion real a "solo Administrador del Sistema" es de UI en WEB (esAdministradorSistema,
// mismo patron ya usado para esDirectivo/esAdministradorPatrimonial) — mostrar cuantos contratos
// existen no es informacion patrimonial sensible, no necesita autorizacion de rol server-side.
@Controller()
@UseGuards(ServiceTokenGuard)
export class IndicadoresController {
  constructor(private readonly indicadoresRepository: IndicadoresRepository) {}

  @Get('indicadores')
  obtener(): Promise<Indicadores> {
    return this.indicadoresRepository.obtener();
  }
}
