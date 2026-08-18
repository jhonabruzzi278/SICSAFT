import { Module } from '@nestjs/common';
import { EventosModule } from '../eventos/eventos.module';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { ContratoController } from './contrato.controller';
import { ContratoRepository } from './contrato.repository';
import { EscrituraContratoService } from './escritura-contrato.service';
import { OrganizacionController } from './organizacion.controller';
import { OrganizacionRepository } from './organizacion.repository';
import { EscrituraOrganizacionService } from './escritura-organizacion.service';

// DOC-012 7 (Fase 4) + DOC-021 4 (Administrador del Sistema) — EscrituraContratoService/
// ContratoRepository/EscrituraOrganizacionService/OrganizacionRepository se exportan para
// OrquestadorModule (ContratoEscrituraController/OrganizacionEscrituraController viven ahí, no
// acá, mismo motivo que ActivoEscrituraController: evita el ciclo <Modulo> -> OrquestadorModule
// -> <Modulo>). ContratoController/OrganizacionController (lectura) sí viven acá — no necesitan
// OrquestadorService.
@Module({
  imports: [EventosModule],
  controllers: [
    EntitlementsController,
    ContratoController,
    OrganizacionController,
  ],
  providers: [
    EntitlementsService,
    ContratoRepository,
    EscrituraContratoService,
    OrganizacionRepository,
    EscrituraOrganizacionService,
  ],
  exports: [
    ContratoRepository,
    EscrituraContratoService,
    OrganizacionRepository,
    EscrituraOrganizacionService,
  ],
})
export class EntitlementsModule {}
