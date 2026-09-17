import { Module } from '@nestjs/common';
import { CoreClientModule } from '../core-client/core-client.module';
import { ActivosAdminController } from './administrador-activos.controller';
import { CatalogoAdminController } from './administrador-catalogo.controller';
import { ImportacionesAdminController } from './administrador-importaciones.controller';
import { AuditoriaAdminController } from './administrador-auditoria.controller';
import { EstructuraAdminController } from './administrador-estructura.controller';
import { AdministradorService } from './administrador.service';

// Puente WEB->CIS->CORE de escritura oficial del CCP (activos, catalogo, documentos, ingesta
// contable, auditoria, estructura). Los 5 controllers comparten el prefijo `admin` (NestJS
// permite varios `@Controller` bajo el mismo prefijo) y cada uno agrupa las rutas de un dominio —
// antes vivian todas en un unico AdministradorController de 472 lineas. 2026-09: sin
// KeycloakAdminModule ni AuditoriaIdentidadModule desde que se retiraron las operaciones de
// identidad del Administrador del Sistema (asignar/quitar usuarios de una Organizacion) junto con
// su portal — hoy solo passthrough a CORE.
@Module({
  imports: [CoreClientModule],
  controllers: [
    ActivosAdminController,
    CatalogoAdminController,
    ImportacionesAdminController,
    AuditoriaAdminController,
    EstructuraAdminController,
  ],
  providers: [AdministradorService],
})
export class AdministradorModule {}
