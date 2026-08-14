import { Module } from '@nestjs/common';
import { EventosModule } from '../eventos/eventos.module';
import { CatalogoController } from './catalogo.controller';
import { ActivoRepository } from './activo.repository';
import { EscrituraActivoService } from './escritura-activo.service';

// DOC-008 (Motor Patrimonial, lectura) + DOC-012 §5 (escritura oficial de Activo, Fase 4) —
// ActivoEscrituraController vive en OrquestadorModule, no acá (mismo motivo que
// InventariosController: evita el ciclo con OrquestadorService). Sin controller de traslado en
// esta fase — sin consumidor real todavia (ver DOC-008 § "Traslado y cambio de ubicacion/estado").
@Module({
  imports: [EventosModule],
  controllers: [CatalogoController],
  providers: [ActivoRepository, EscrituraActivoService],
  exports: [ActivoRepository, EscrituraActivoService],
})
export class PatrimonialModule {}
