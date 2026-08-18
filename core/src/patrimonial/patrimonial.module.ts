import { Module } from '@nestjs/common';
import { EventosModule } from '../eventos/eventos.module';
import { CatalogoController } from './catalogo.controller';
import { ActivoRepository } from './activo.repository';
import { EscrituraActivoService } from './escritura-activo.service';
import { ImportacionContableService } from './importacion-contable.service';

// DOC-008 (Motor Patrimonial, lectura) + DOC-012 5/6 (escritura oficial de Activo e importacion
// masiva, Fase 4) — ActivoEscrituraController/ImportacionContableController viven en
// OrquestadorModule, no acá (mismo motivo que InventariosController: evita el ciclo con
// OrquestadorService). Sin controller de traslado en esta fase — sin consumidor real todavia (ver
// DOC-008 "Traslado y cambio de ubicacion/estado").
@Module({
  imports: [EventosModule],
  controllers: [CatalogoController],
  providers: [
    ActivoRepository,
    EscrituraActivoService,
    ImportacionContableService,
  ],
  exports: [
    ActivoRepository,
    EscrituraActivoService,
    ImportacionContableService,
  ],
})
export class PatrimonialModule {}
