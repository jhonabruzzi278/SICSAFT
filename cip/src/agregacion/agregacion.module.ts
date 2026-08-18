import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { CoreClientModule } from '../core-client/core-client.module';
import { AgregacionRepository } from './agregacion.repository';
import { AgregacionService } from './agregacion.service';
import { createRedisConnection } from './create-redis-connection';
import { CIP_EVENTOS_QUEUE_NAME } from './eventos-outbox.constants';
import {
  CIP_EVENTOS_QUEUE,
  CIP_EVENTOS_REDIS_CONNECTION,
} from './eventos-outbox-queue.constants';
import { EventosOutboxWorker } from './eventos-outbox.worker';
import { loadRedisConfig } from './redis.config';
import { SyncEstadoWatcher } from './sync-estado.watcher';

// Segunda conexion a Redis del lado de CIP (la primera la abre EventosOutboxWorker para el
// Worker en si) — esta es de solo lectura, la usa SyncEstadoWatcher para `getWaitingCount()`
// (RF-10). Mismo patron de cleanup que core/src/eventos-outbox/eventos-outbox.module.ts: el
// modulo cierra ambas (queue + conexion) en onModuleDestroy.
@Module({
  imports: [ScheduleModule.forRoot(), CoreClientModule],
  providers: [
    AgregacionRepository,
    AgregacionService,
    EventosOutboxWorker,
    {
      provide: CIP_EVENTOS_REDIS_CONNECTION,
      useFactory: (): Redis => createRedisConnection(loadRedisConfig().url),
    },
    {
      provide: CIP_EVENTOS_QUEUE,
      useFactory: (connection: Redis): Queue =>
        new Queue(CIP_EVENTOS_QUEUE_NAME, { connection }),
      inject: [CIP_EVENTOS_REDIS_CONNECTION],
    },
    SyncEstadoWatcher,
  ],
})
export class AgregacionModule implements OnModuleDestroy {
  constructor(
    @Inject(CIP_EVENTOS_QUEUE) private readonly queue: Queue,
    @Inject(CIP_EVENTOS_REDIS_CONNECTION) private readonly connection: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}
