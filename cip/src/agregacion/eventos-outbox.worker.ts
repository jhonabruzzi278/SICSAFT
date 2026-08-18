import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import type Redis from 'ioredis';
import { AgregacionService } from './agregacion.service';
import { createRedisConnection } from './create-redis-connection';
import { CIP_EVENTOS_QUEUE_NAME } from './eventos-outbox.constants';
import { loadRedisConfig } from './redis.config';
import type { MensajeAgregacion } from './agregacion.service';

// DOC-018 §5 — consumidor BullMQ de la cola que ya publica EventosOutboxDispatcher del lado de
// CORE (core/src/eventos-outbox/, PR #8). Un mensaje que falla queda a cargo de los reintentos
// propios de BullMQ (at-least-once, ver DOC-018 §5.3) — este worker no implementa su propia
// logica de reintento.
@Injectable()
export class EventosOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventosOutboxWorker.name);
  private worker?: Worker<MensajeAgregacion>;
  // BullMQ no cierra una conexion de ioredis que le pasamos nosotros — mismo hallazgo que
  // core/src/eventos-outbox/eventos-outbox.module.ts, se guarda aparte para desconectarla en
  // onModuleDestroy.
  private connection?: Redis;

  constructor(private readonly agregacionService: AgregacionService) {}

  onModuleInit(): void {
    const config = loadRedisConfig();
    this.connection = createRedisConnection(config.url);

    this.worker = new Worker<MensajeAgregacion>(
      CIP_EVENTOS_QUEUE_NAME,
      (job: Job<MensajeAgregacion>) =>
        this.agregacionService.procesarMensaje(job.data),
      { connection: this.connection },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Job ${job?.id ?? '(sin id)'} de ${CIP_EVENTOS_QUEUE_NAME} falló: ${error.message}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    this.connection?.disconnect();
  }
}
