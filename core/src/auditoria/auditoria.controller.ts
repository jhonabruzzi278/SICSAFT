import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ServiceTokenGuard } from '../common/auth/service-token.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuditoriaRepository } from './auditoria.repository';
import { auditoriaQuerySchema } from './auditoria.schemas';
import type { AuditoriaQuery } from './auditoria.schemas';
import type { AuditoriaPagina } from './auditoria.types';

// RF-06 (Fase 5, WEB) — lectura abierta a cualquier llamador autenticado como CIS, mismo criterio
// que ContratoController.getContratos: sin dato de organizacionId en la tabla (DOC-005 7), no
// hay forma de exigir el rol contra una organizacion especifica todavia (ver DOC-011, sin
// consumidor hasta ahora). Filtros por usuario/operacion/fecha (ver auditoria.types.ts). Paginado
// (RNF-01, cierra el gap) — antes devolvia hasta 200 filas sin offset.
@Controller()
@UseGuards(ServiceTokenGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaRepository: AuditoriaRepository) {}

  @Get('auditoria')
  getAuditoria(
    @Query(new ZodValidationPipe(auditoriaQuerySchema)) query: AuditoriaQuery,
  ): Promise<AuditoriaPagina> {
    return this.auditoriaRepository.listar(query);
  }
}
