import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import type { PgBoss } from 'pg-boss';
import { CoreClientModule } from '../core-client/core-client.module';
import { AgregacionRepository } from './agregacion.repository';
import { AgregacionService } from './agregacion.service';
import { createPgBossClient } from './create-pgboss-client';
import { CIP_EVENTOS_PGBOSS } from './eventos-outbox-queue.constants';
import { loadEventosOutboxQueueConfig } from './eventos-outbox-queue.config';
import { CIP_EVENTOS_QUEUE_NAME } from './eventos-outbox.constants';
import { EventosOutboxWorker } from './eventos-outbox.worker';
import { SyncEstadoWatcher } from './sync-estado.watcher';

// ADR-005 — único cliente pg-boss del lado de CIP, compartido por EventosOutboxWorker (consume
// vía `work()`) y SyncEstadoWatcher (lee vía `getQueue()`) — antes eran dos conexiones ioredis
// separadas (una para el Worker de BullMQ, otra de solo lectura para getWaitingCount()). El
// módulo lo arranca y lo detiene en onModuleDestroy, mismo patrón que
// core/src/eventos-outbox/eventos-outbox.module.ts.
@Module({
  imports: [ScheduleModule.forRoot(), CoreClientModule],
  providers: [
    AgregacionRepository,
    AgregacionService,
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
    EventosOutboxWorker,
    SyncEstadoWatcher,
  ],
})
export class AgregacionModule implements OnModuleDestroy {
  constructor(@Inject(CIP_EVENTOS_PGBOSS) private readonly boss: PgBoss) {}

  async onModuleDestroy(): Promise<void> {
    await this.boss.stop();
  }
}
