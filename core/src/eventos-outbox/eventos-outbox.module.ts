import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { createRedisConnection } from './create-redis-connection';
import {
  CIP_EVENTOS_QUEUE,
  CIP_EVENTOS_QUEUE_NAME,
  CIP_EVENTOS_REDIS_CONNECTION,
} from './eventos-outbox.constants';
import { EventosOutboxDispatcher } from './eventos-outbox.dispatcher';
import { EventosOutboxRepository } from './eventos-outbox.repository';
import { loadRedisConfig } from './redis.config';

// Fase 6 — unico consumidor de @nestjs/schedule en CORE hoy, ScheduleModule.forRoot() se importa
// acá en vez de en AppModule (mismo criterio de localidad que el resto de modulos de CORE: cada
// feature module trae lo que necesita).
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    EventosOutboxRepository,
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
    EventosOutboxDispatcher,
  ],
})
export class EventosOutboxModule implements OnModuleDestroy {
  constructor(
    @Inject(CIP_EVENTOS_QUEUE) private readonly queue: Queue,
    @Inject(CIP_EVENTOS_REDIS_CONNECTION) private readonly connection: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}
