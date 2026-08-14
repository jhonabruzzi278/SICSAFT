import { Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaRepository } from './auditoria.repository';

// DOC-011 — RF-06 (Fase 5) agrega el primer consumidor real (GET /auditoria para WEB), ver
// AuditoriaController.
@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaRepository],
  exports: [AuditoriaRepository],
})
export class AuditoriaModule {}
