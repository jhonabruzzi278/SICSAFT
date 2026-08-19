import { Module } from '@nestjs/common';
import { ZitadelAdminModule } from '../zitadel-admin/zitadel-admin.module';
import { DirectivoController } from './directivo.controller';
import { DirectivoService } from './directivo.service';
import { DirectivoGuard } from './directivo.guard';

// DOC-022 3 — mismo ZitadelAdminModule que AdministradorModule (Fase 2 de DOC-021), sin cambios
// ahí: dos módulos de CIS distintos consumiendo el mismo cliente de la API de administración de
// Zitadel, cada uno con su propio guard/alcance de organización.
@Module({
  imports: [ZitadelAdminModule],
  controllers: [DirectivoController],
  providers: [DirectivoService, DirectivoGuard],
})
export class DirectivoModule {}
