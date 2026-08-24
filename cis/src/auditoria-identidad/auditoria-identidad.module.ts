import { Module } from '@nestjs/common';
import { CoreClientModule } from '../core-client/core-client.module';
import { AuditoriaIdentidadService } from './auditoria-identidad.service';

// DOC-024 3 — consumido por AdministradorModule y DirectivoModule para las operaciones de
// identidad que hoy quedan fuera del Motor de Auditoria de Tomo IV (ver el comentario en
// auditoria-identidad.service.ts).
@Module({
  imports: [CoreClientModule],
  providers: [AuditoriaIdentidadService],
  exports: [AuditoriaIdentidadService],
})
export class AuditoriaIdentidadModule {}
