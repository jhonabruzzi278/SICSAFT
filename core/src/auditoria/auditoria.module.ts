import { Module } from '@nestjs/common';
import { AuditoriaRepository } from './auditoria.repository';

// DOC-011 — sin controller propio en esta fase (sin consumidor, ver DOC-011 § "Que NO resuelve").
@Module({
  providers: [AuditoriaRepository],
  exports: [AuditoriaRepository],
})
export class AuditoriaModule {}
