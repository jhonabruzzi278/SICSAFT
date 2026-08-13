import { Module } from '@nestjs/common';
import { CatalogoController } from './catalogo.controller';
import { ActivoRepository } from './activo.repository';

// DOC-008 (Motor Patrimonial). Sin controller de traslado/cambio de estado en esta fase — sin
// consumidor real todavia (ver DOC-008 § "Traslado y cambio de ubicacion/estado").
@Module({
  controllers: [CatalogoController],
  providers: [ActivoRepository],
  exports: [ActivoRepository],
})
export class PatrimonialModule {}
