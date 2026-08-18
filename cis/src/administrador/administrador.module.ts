import { Module } from '@nestjs/common';
import { CoreClientModule } from '../core-client/core-client.module';
import { ZitadelAdminModule } from '../zitadel-admin/zitadel-admin.module';
import { AdministradorController } from './administrador.controller';
import { AdministradorService } from './administrador.service';
import { AdministradorSistemaGuard } from './administrador-sistema.guard';
import { ORGANIZACION_MAPPING } from './administrador.constants';
import { loadOrganizacionMapping } from './organizacion-mapping.config';

// DOC-021 4 — ZitadelAdminModule nuevo (asignar usuarios a organizaciones, integración real con
// Zitadel), sin tocar CoreClientModule.
@Module({
  imports: [CoreClientModule, ZitadelAdminModule],
  controllers: [AdministradorController],
  providers: [
    AdministradorService,
    AdministradorSistemaGuard,
    { provide: ORGANIZACION_MAPPING, useFactory: loadOrganizacionMapping },
  ],
})
export class AdministradorModule {}
