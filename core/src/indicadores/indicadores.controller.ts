import { Controller, Get, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { IndicadoresRepository } from './indicadores.repository';
import type { Indicadores } from './indicadores.types';

// DOC-023 3 — solo ServiceTokenGuard aca (CIS es el unico caller valido, igual que el resto de
// endpoints GET de CORE). El chequeo de rol `administrador-sistema` para llegar hasta aca vive en
// CIS (AdministradorSistemaEnCualquierOrganizacionGuard, GET /admin/indicadores en
// administrador.controller.ts) — antes de DOC-023 este endpoint era alcanzable por cualquier
// operador autenticado sin distincion de rol, la restriccion real era solo de UI en web_admin.
@Controller()
@UseGuards(ServiceTokenGuard)
export class IndicadoresController {
  constructor(private readonly indicadoresRepository: IndicadoresRepository) {}

  @Get('indicadores')
  obtener(): Promise<Indicadores> {
    return this.indicadoresRepository.obtener();
  }
}
