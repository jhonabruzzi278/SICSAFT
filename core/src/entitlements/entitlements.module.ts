import { Module } from '@nestjs/common';
import { EventosModule } from '../eventos/eventos.module';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { ContratoRepository } from './contrato.repository';

// GET /entitlements (EntitlementsController) resuelve el contrato vigente + módulos contratados de
// una organización — lo consume `cis` en `auth/session` para todos los portales. 2026-09: se
// retiraron los controllers/servicios de escritura de Organización/Sede/Contrato y sus GET
// standalone junto con el portal del Administrador del Sistema; la intervención del proveedor en
// el core de la organización pasa a ser directa (BD / script) + el bootstrap del wizard.
// ContratoRepository se exporta porque `entitlements.service` lo usa y `contrato.seed` (fixture de
// tests) también.
@Module({
  imports: [EventosModule],
  controllers: [EntitlementsController],
  providers: [EntitlementsService, ContratoRepository],
  exports: [ContratoRepository],
})
export class EntitlementsModule {}
