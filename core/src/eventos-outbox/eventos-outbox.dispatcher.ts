import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Queue } from 'bullmq';
import {
  CIP_EVENTOS_QUEUE,
  CIP_EVENTOS_QUEUE_NAME,
} from './eventos-outbox.constants';
import { EventosOutboxRepository } from './eventos-outbox.repository';
import type {
  EventoOutboxPendiente,
  EventosOutboxMensaje,
} from './eventos-outbox.types';

// Fase 6 / ARCHITECTURE.md §2-§4 — proceso de polling separado del camino sincrono de
// POST /inventarios: si Redis esta caido, `queue.add` tira, este metodo no marca nada como
// publicado y simplemente reintenta en el proximo ciclo (RNF-03) — el resto de CORE sigue
// funcionando normal, no depende de esto.
const INTERVALO_POLLING_MS = 5000;
const LOTE_MAXIMO = 200;

@Injectable()
export class EventosOutboxDispatcher {
  private readonly logger = new Logger(EventosOutboxDispatcher.name);

  constructor(
    private readonly repository: EventosOutboxRepository,
    @Inject(CIP_EVENTOS_QUEUE)
    private readonly queue: Queue<EventosOutboxMensaje>,
  ) {}

  @Interval(INTERVALO_POLLING_MS)
  async despachar(): Promise<void> {
    const pendientes = await this.repository.findPendientes(LOTE_MAXIMO);
    if (pendientes.length === 0) {
      return;
    }

    const publicadosIds = await this.publicarLote(pendientes);
    await this.repository.marcarPublicados(publicadosIds);
  }

  // Agrupa por sesionId (ARCHITECTURE.md §4 — un solo mensaje `sesion-cerrada` por sesion, no uno
  // por escaneo) y publica el resto individualmente. Publica lo que pueda: si Redis falla a mitad
  // de camino, devuelve solo los ids que sí llegaron a la cola — el resto queda pendiente para el
  // proximo ciclo (at-least-once, el worker de CIP debe ser idempotente ante un mensaje repetido,
  // igual que ya lo es InventariosService.registrarEventosDeEscaneo del lado de CORE).
  private async publicarLote(
    pendientes: readonly EventoOutboxPendiente[],
  ): Promise<string[]> {
    const publicadosIds: string[] = [];

    const porSesion = new Map<string, string[]>();
    const individuales: EventoOutboxPendiente[] = [];
    for (const item of pendientes) {
      if (item.sesionId) {
        const idsDeLaSesion = porSesion.get(item.sesionId) ?? [];
        idsDeLaSesion.push(item.id);
        porSesion.set(item.sesionId, idsDeLaSesion);
      } else {
        individuales.push(item);
      }
    }

    for (const [sesionId, idsDeLaSesion] of porSesion) {
      const publicado = await this.intentarPublicar({
        kind: 'sesion-cerrada',
        sesionId,
      });
      if (!publicado) {
        return publicadosIds;
      }
      publicadosIds.push(...idsDeLaSesion);
    }

    for (const evento of individuales) {
      const publicado = await this.intentarPublicar({
        kind: 'evento',
        eventoId: evento.eventoId,
        tipo: evento.tipo,
        organizacionId: evento.organizacionId,
      });
      if (!publicado) {
        return publicadosIds;
      }
      publicadosIds.push(evento.id);
    }

    return publicadosIds;
  }

  private async intentarPublicar(
    mensaje: EventosOutboxMensaje,
  ): Promise<boolean> {
    try {
      await this.queue.add(mensaje.kind, mensaje);
      return true;
    } catch (error: unknown) {
      const detalle = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `No se pudo publicar a la cola ${CIP_EVENTOS_QUEUE_NAME}: ${detalle}`,
      );
      return false;
    }
  }
}
