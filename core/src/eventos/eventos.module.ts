import { Module } from '@nestjs/common';
import { EventoRepository } from './evento.repository';

// DOC-010 — sin controller propio, ver "Que hace" en el DOC.
@Module({
  providers: [EventoRepository],
  exports: [EventoRepository],
})
export class EventosModule {}
