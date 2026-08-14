import { Controller, Get, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ContratoRepository } from './contrato.repository';
import type { Contrato } from './contrato.types';

// DOC-012 §4 — "Consultar Contrato" está abierto a cualquier llamador autenticado como CIS (APP
// QR, WEB, RFID), no solo al Administrador Patrimonial — mismo criterio que CatalogoController
// (`ServiceTokenGuard` a secas, sin `verificarRolAdministradorPatrimonial`). Necesario para que
// WEB pueda listar contratos y saber qué `id` mandarle a `PATCH /contratos/:id` (DOC-012 §7) —
// antes de este endpoint no había forma de leer el `id`/`estado` real de un contrato, solo el
// resumen que expone `GET /entitlements`.
@Controller()
@UseGuards(ServiceTokenGuard)
export class ContratoController {
  constructor(private readonly contratoRepository: ContratoRepository) {}

  @Get('contratos')
  getContratos(): Promise<Contrato[]> {
    return this.contratoRepository.findAll();
  }
}
