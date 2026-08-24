import { Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaEscrituraController } from './auditoria-escritura.controller';
import { AuditoriaRepository } from './auditoria.repository';

// DOC-011 — RF-06 (Fase 5) agrega el primer consumidor real (GET /auditoria para WEB), ver
// AuditoriaController. DOC-024 3 — AuditoriaEscrituraController (POST /auditoria, eventos de
// identidad reportados por CIS) vive acá y no en OrquestadorModule, ver su propio comentario.
@Module({
  controllers: [AuditoriaController, AuditoriaEscrituraController],
  providers: [AuditoriaRepository],
  exports: [AuditoriaRepository],
})
export class AuditoriaModule {}
