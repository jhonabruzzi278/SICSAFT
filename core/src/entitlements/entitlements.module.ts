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
import { SedeController } from './sede.controller';
import { SedeRepository } from './sede.repository';
import { EscrituraSedeService } from './escritura-sede.service';

// DOC-012 7 (Fase 4) + DOC-021 4 (Administrador del Sistema) + Gap 2 (flujo real Admin->Directivo
// ->Profesional AFT) — EscrituraContratoService/ContratoRepository/EscrituraOrganizacionService/
// OrganizacionRepository/EscrituraSedeService/SedeRepository se exportan para OrquestadorModule
// (ContratoEscrituraController/OrganizacionEscrituraController/SedeEscrituraController viven ahí,
// no acá, mismo motivo que ActivoEscrituraController: evita el ciclo <Modulo> ->
// OrquestadorModule -> <Modulo>). ContratoController/OrganizacionController/SedeController
// (lectura) sí viven acá — no necesitan OrquestadorService. DOC-024 1 agrega SedeController: hasta
// ese incremento Sede no tenia controller de lectura propio (se leia vía JOIN dentro de
// ContratoRepository).
@Module({
  imports: [EventosModule],
  controllers: [
    EntitlementsController,
    ContratoController,
    OrganizacionController,
    SedeController,
  ],
  providers: [
    EntitlementsService,
    ContratoRepository,
    EscrituraContratoService,
    OrganizacionRepository,
    EscrituraOrganizacionService,
    SedeRepository,
    EscrituraSedeService,
  ],
  exports: [
    ContratoRepository,
    EscrituraContratoService,
    OrganizacionRepository,
    EscrituraOrganizacionService,
    SedeRepository,
    EscrituraSedeService,
  ],
})
export class EntitlementsModule {}
