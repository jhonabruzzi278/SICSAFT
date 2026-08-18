import { Controller, Get, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { OrganizacionRepository } from './organizacion.repository';
import type { Organizacion } from './organizacion.types';

// DOC-021 4 — lectura abierta (mismo criterio que ContratoController): el Administrador del
// Sistema necesita ver TODAS las organizaciones (incluidas las sin contrato vigente, para poder
// crearles el primero) — a diferencia de GET /entitlements, que filtra por contrato vigente +
// modulo contratado.
@Controller()
@UseGuards(ServiceTokenGuard)
export class OrganizacionController {
  constructor(
    private readonly organizacionRepository: OrganizacionRepository,
  ) {}

  @Get('organizaciones')
  listar(): Promise<Organizacion[]> {
    return this.organizacionRepository.listar();
  }
}
