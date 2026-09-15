import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AgregacionService } from './agregacion.service';

// DOC-034 Parte B — corte nocturno de `resumen_diario`. @nestjs/schedule ya estaba importado en
// AgregacionModule (ScheduleModule.forRoot()) sin ningún @Cron() registrado todavía; se reusa esa
// infraestructura en vez de sumar un schedule de pg-boss nuevo — más simple y ya soporta `timeZone`
// de forma nativa. Sin esto el cron correría en UTC (medianoche UTC = 20-21hs en Chile según
// horario de verano), no a la medianoche real del cliente.
@Injectable()
export class ResumenDiarioScheduler {
  private readonly logger = new Logger(ResumenDiarioScheduler.name);

  constructor(private readonly agregacionService: AgregacionService) {}

  @Cron('0 0 * * *', { timeZone: 'America/Santiago' })
  async ejecutar(): Promise<void> {
    try {
      await this.agregacionService.procesarResumenDiario();
    } catch (error: unknown) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.error(`Corte nocturno de resumen_diario falló: ${detalle}`);
    }
  }
}
