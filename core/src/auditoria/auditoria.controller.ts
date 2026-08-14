import { Controller, Get, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { AuditoriaRepository } from './auditoria.repository';
import type { AuditoriaEntrada } from './auditoria.types';

// RF-06 (Fase 5, WEB) — lectura abierta a cualquier llamador autenticado como CIS, mismo criterio
// que ContratoController.getContratos: sin dato de organizacionId en la tabla (DOC-005 §7), no
// hay forma de exigir el rol contra una organizacion especifica todavia (ver DOC-011, sin
// consumidor hasta ahora).
@Controller()
@UseGuards(ServiceTokenGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaRepository: AuditoriaRepository) {}

  @Get('auditoria')
  getAuditoria(): Promise<AuditoriaEntrada[]> {
    return this.auditoriaRepository.listar();
  }
}
