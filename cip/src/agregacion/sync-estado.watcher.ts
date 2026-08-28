import { Inject, Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { PgBoss } from 'pg-boss';
import { AgregacionRepository } from './agregacion.repository';
import { CIP_EVENTOS_PGBOSS } from './eventos-outbox-queue.constants';
import { CIP_EVENTOS_QUEUE_NAME } from './eventos-outbox.constants';

// ARCHITECTURA.md 7 / DOC-018 5.4 — RF-10: "al_dia" solo pasa a false si hay mensajes
// esperando en la cola Y el ultimo procesado fue hace mas de CIP_UMBRAL_ATRASO_MINUTOS. Una cola
// vacia nunca esta atrasada, aunque haga horas del ultimo mensaje (silencio no es lo mismo que
// atraso).
const INTERVALO_VERIFICACION_MS = 30000;
const UMBRAL_ATRASO_MINUTOS_DEFAULT = 15;

@Injectable()
export class SyncEstadoWatcher {
  constructor(
    private readonly repository: AgregacionRepository,
    @Inject(CIP_EVENTOS_PGBOSS) private readonly boss: PgBoss,
  ) {}

  @Interval(INTERVALO_VERIFICACION_MS)
  async verificar(): Promise<void> {
    const cola = await this.boss.getQueue(CIP_EVENTOS_QUEUE_NAME);
    // readyCount = queuedCount - deferredCount (clamped a 0) — el backlog real que todavia no se
    // proceso, mismo concepto que Queue.getWaitingCount() de BullMQ (ADR-005).
    const pendientes = cola?.readyCount ?? 0;
    if (pendientes === 0) {
      return;
    }

    const estado = await this.repository.obtenerSyncEstado();
    if (!estado.ultimoEventoProcesadoEn) {
      // Nunca se proceso nada todavia y ya hay pendientes: atrasado desde el arranque.
      await this.repository.marcarAtrasado();
      return;
    }

    const minutosDesdeUltimoProcesado =
      (Date.now() - new Date(estado.ultimoEventoProcesadoEn).getTime()) / 60000;
    const umbral = Number(
      process.env.CIP_UMBRAL_ATRASO_MINUTOS ?? UMBRAL_ATRASO_MINUTOS_DEFAULT,
    );

    if (minutosDesdeUltimoProcesado > umbral) {
      await this.repository.marcarAtrasado();
    }
  }
}
