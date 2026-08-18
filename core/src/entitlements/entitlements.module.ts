import { Module } from '@nestjs/common';
import { EventosModule } from '../eventos/eventos.module';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { ContratoController } from './contrato.controller';
import { ContratoRepository } from './contrato.repository';
import { EscrituraContratoService } from './escritura-contrato.service';

// DOC-012 7 (Fase 4) — EscrituraContratoService/ContratoRepository se exportan para
// OrquestadorModule (ContratoEscrituraController vive ahí, no acá, mismo motivo que
// ActivoEscrituraController: evita el ciclo <Modulo> -> OrquestadorModule -> <Modulo>).
// ContratoController (GET /contratos, lectura) sí vive acá — no necesita OrquestadorService.
@Module({
  imports: [EventosModule],
  controllers: [EntitlementsController, ContratoController],
  providers: [
    EntitlementsService,
    ContratoRepository,
    EscrituraContratoService,
  ],
  exports: [ContratoRepository, EscrituraContratoService],
})
export class EntitlementsModule {}
