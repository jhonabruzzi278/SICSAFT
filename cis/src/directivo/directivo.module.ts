import { Module } from '@nestjs/common';
import { KeycloakAdminModule } from '../keycloak-admin/keycloak-admin.module';
import { AuditoriaIdentidadModule } from '../auditoria-identidad/auditoria-identidad.module';
import { DirectivoController } from './directivo.controller';
import { DirectivoService } from './directivo.service';
import { DirectivoGuard } from './directivo.guard';

// DOC-022 3 — ADR-004: KeycloakAdminModule reemplaza a ZitadelAdminModule, mismo criterio de dos
// módulos de CIS (este y AdministradorModule) consumiendo el mismo cliente de administración de
// identidad, cada uno con su propio guard/alcance de organización. AuditoriaIdentidadModule
// (DOC-024 3) — auditar la designación del Profesional de AFT, que nunca pasa por CORE.
@Module({
  imports: [KeycloakAdminModule, AuditoriaIdentidadModule],
  controllers: [DirectivoController],
  providers: [DirectivoService, DirectivoGuard],
})
export class DirectivoModule {}
