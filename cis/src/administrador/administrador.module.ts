import { Module } from '@nestjs/common';
import { CoreClientModule } from '../core-client/core-client.module';
import { AuditoriaIdentidadModule } from '../auditoria-identidad/auditoria-identidad.module';
import { KeycloakAdminModule } from '../keycloak-admin/keycloak-admin.module';
import { AdministradorController } from './administrador.controller';
import { AdministradorService } from './administrador.service';
import { AdministradorSistemaGuard } from './administrador-sistema.guard';
import { AdministradorSistemaEnCualquierOrganizacionGuard } from './administrador-sistema-cualquier-organizacion.guard';

// ADR-004 — KeycloakAdminModule reemplaza a ZitadelAdminModule. RedisModule/ORGANIZACION_MAPPING/
// OrganizacionMappingDinamicoService ya no hacen falta: con Keycloak, el organizacionId que llega
// en rolesPorOrganizacion YA ES el mismo que usa CORE (el alias de la Organization, ver
// KeycloakAdminService.crearOrganizacion) — no hay dos ids distintos que traducir.
// AuditoriaIdentidadModule (DOC-024 3) sigue igual, auditar las operaciones de identidad que nunca
// pasan por CORE.
@Module({
  imports: [CoreClientModule, KeycloakAdminModule, AuditoriaIdentidadModule],
  controllers: [AdministradorController],
  providers: [
    AdministradorService,
    AdministradorSistemaGuard,
    AdministradorSistemaEnCualquierOrganizacionGuard,
  ],
})
export class AdministradorModule {}
