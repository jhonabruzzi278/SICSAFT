import { Module } from '@nestjs/common';
import { ZitadelAdminModule } from '../zitadel-admin/zitadel-admin.module';
import { AuditoriaIdentidadModule } from '../auditoria-identidad/auditoria-identidad.module';
import { DirectivoController } from './directivo.controller';
import { DirectivoService } from './directivo.service';
import { DirectivoGuard } from './directivo.guard';

// DOC-022 3 — mismo ZitadelAdminModule que AdministradorModule (Fase 2 de DOC-021), sin cambios
// ahí: dos módulos de CIS distintos consumiendo el mismo cliente de la API de administración de
// Zitadel, cada uno con su propio guard/alcance de organización. AuditoriaIdentidadModule
// (DOC-024 3) — auditar la designación del Profesional de AFT, que nunca pasa por CORE.
@Module({
  imports: [ZitadelAdminModule, AuditoriaIdentidadModule],
  controllers: [DirectivoController],
  providers: [DirectivoService, DirectivoGuard],
})
export class DirectivoModule {}
