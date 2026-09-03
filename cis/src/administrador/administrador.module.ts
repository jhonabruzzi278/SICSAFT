import { Module } from '@nestjs/common';
import { CoreClientModule } from '../core-client/core-client.module';
import { AdministradorController } from './administrador.controller';
import { AdministradorService } from './administrador.service';

// Puente WEB->CIS->CORE de escritura oficial del CCP (activos, catalogo, documentos, ingesta
// contable, auditoria, estructura). 2026-09: sin KeycloakAdminModule ni AuditoriaIdentidadModule
// desde que se retiraron las operaciones de identidad del Administrador del Sistema (asignar/
// quitar usuarios de una Organizacion) junto con su portal — hoy solo passthrough a CORE.
@Module({
  imports: [CoreClientModule],
  controllers: [AdministradorController],
  providers: [AdministradorService],
})
export class AdministradorModule {}
