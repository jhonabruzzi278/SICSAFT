import { Module } from '@nestjs/common';
import { CoreClientModule } from '../core-client/core-client.module';
import { AuditoriaIdentidadModule } from '../auditoria-identidad/auditoria-identidad.module';
import { ZitadelAdminModule } from '../zitadel-admin/zitadel-admin.module';
import { RedisModule } from '../redis/redis.module';
import { AdministradorController } from './administrador.controller';
import { AdministradorService } from './administrador.service';
import { AdministradorSistemaGuard } from './administrador-sistema.guard';
import { AdministradorSistemaEnCualquierOrganizacionGuard } from './administrador-sistema-cualquier-organizacion.guard';
import { OrganizacionMappingDinamicoService } from './organizacion-mapping-dinamico.service';
import { ORGANIZACION_MAPPING } from './administrador.constants';
import { loadOrganizacionMapping } from './organizacion-mapping.config';

// DOC-021 4 — ZitadelAdminModule nuevo (asignar usuarios a organizaciones, integración real con
// Zitadel), sin tocar CoreClientModule. RedisModule (Gap 0/1 del flujo real Admin->Directivo->
// Profesional AFT) — mismo REDIS_CLIENT global que ya usan RateLimitModule/DeviceRegistryModule,
// importado acá explícito por claridad aunque sea @Global(). AuditoriaIdentidadModule (DOC-024 3)
// — auditar las operaciones de identidad que nunca pasan por CORE.
@Module({
  imports: [
    CoreClientModule,
    ZitadelAdminModule,
    RedisModule,
    AuditoriaIdentidadModule,
  ],
  controllers: [AdministradorController],
  providers: [
    AdministradorService,
    AdministradorSistemaGuard,
    AdministradorSistemaEnCualquierOrganizacionGuard,
    OrganizacionMappingDinamicoService,
    { provide: ORGANIZACION_MAPPING, useFactory: loadOrganizacionMapping },
  ],
})
export class AdministradorModule {}
