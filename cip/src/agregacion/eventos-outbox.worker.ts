import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { PgBoss } from 'pg-boss';
import { AgregacionService } from './agregacion.service';
import { CIP_EVENTOS_PGBOSS } from './eventos-outbox-queue.constants';
import { CIP_EVENTOS_QUEUE_NAME } from './eventos-outbox.constants';
import type { MensajeAgregacion } from './agregacion.service';

// DOC-018 5 — consumidor pg-boss (ADR-005; antes BullMQ) de la cola que ya publica
// EventosOutboxDispatcher del lado de CORE (core/src/eventos-outbox/, PR #8). Un mensaje que
// falla queda a cargo de los reintentos propios de pg-boss (at-least-once, ver DOC-018 5.3) —
// este worker no implementa su propia logica de reintento: un throw dentro del handler es
// suficiente, pg-boss lo marca failed y lo reintenta solo.
@Injectable()
export class EventosOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventosOutboxWorker.name);

  constructor(
    private readonly agregacionService: AgregacionService,
    @Inject(CIP_EVENTOS_PGBOSS) private readonly boss: PgBoss,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.boss.work<MensajeAgregacion>(
      CIP_EVENTOS_QUEUE_NAME,
      async ([job]) => {
        try {
          await this.agregacionService.procesarMensaje(job.data);
        } catch (error: unknown) {
          const detalle =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Job ${job.id} de ${CIP_EVENTOS_QUEUE_NAME} falló: ${detalle}`,
          );
          throw error;
        }
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss.offWork(CIP_EVENTOS_QUEUE_NAME);
  }
}
