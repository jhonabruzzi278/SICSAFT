import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import type { PgBoss } from 'pg-boss';
import { createPgBossClient } from './create-pgboss-client';
import {
  CIP_EVENTOS_PGBOSS,
  CIP_EVENTOS_QUEUE_NAME,
} from './eventos-outbox.constants';
import { loadEventosOutboxQueueConfig } from './eventos-outbox-queue.config';
import { EventosOutboxDispatcher } from './eventos-outbox.dispatcher';
import { EventosOutboxRepository } from './eventos-outbox.repository';

// Fase 6 — único consumidor de @nestjs/schedule en CORE hoy, ScheduleModule.forRoot() se importa
// acá en vez de en AppModule (mismo criterio de localidad que el resto de módulos de CORE: cada
// feature module trae lo que necesita).
//
// ADR-005 — `boss.start()` aplica la migración del esquema propio de pg-boss (`pgboss` por
// defecto) y `createQueue` es idempotente (no falla si la cola ya existe) — ambos se llaman acá,
// una sola vez al armar el módulo, en vez de en cada `send()`.
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    EventosOutboxRepository,
    {
      provide: CIP_EVENTOS_PGBOSS,
      useFactory: async (): Promise<PgBoss> => {
        const boss = await createPgBossClient(
          loadEventosOutboxQueueConfig().connectionString,
        );
        await boss.start();
        await boss.createQueue(CIP_EVENTOS_QUEUE_NAME);
        return boss;
      },
    },
    EventosOutboxDispatcher,
  ],
})
export class EventosOutboxModule implements OnModuleDestroy {
  constructor(@Inject(CIP_EVENTOS_PGBOSS) private readonly boss: PgBoss) {}

  async onModuleDestroy(): Promise<void> {
    await this.boss.stop();
  }
}
