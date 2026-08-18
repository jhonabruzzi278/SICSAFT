import { Module } from '@nestjs/common';
import { AreaController } from './area.controller';
import { AreaRepository } from './area.repository';
import { UbicacionController } from './ubicacion.controller';
import { UbicacionRepository } from './ubicacion.repository';
import { ResponsableController } from './responsable.controller';
import { ResponsableRepository } from './responsable.repository';
import { EscrituraEstructuraService } from './escritura-estructura.service';

// RF-05 (Fase 5) — Area/Ubicacion/Responsable (DOC-005 2/3). El controller de escritura
// (EstructuraEscrituraController) vive en OrquestadorModule, no acá — mismo motivo que
// ActivoEscrituraController: evita el ciclo <Modulo> -> OrquestadorModule -> <Modulo>.
@Module({
  controllers: [AreaController, UbicacionController, ResponsableController],
  providers: [
    AreaRepository,
    UbicacionRepository,
    ResponsableRepository,
    EscrituraEstructuraService,
  ],
  exports: [
    AreaRepository,
    UbicacionRepository,
    ResponsableRepository,
    EscrituraEstructuraService,
  ],
})
export class EstructuraModule {}
