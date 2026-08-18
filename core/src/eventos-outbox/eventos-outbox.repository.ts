import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type { EventoOutboxPendiente } from './eventos-outbox.types';

// Fase 6 — lee/marca la tabla que alimenta el trigger de la migracion 1755500000000. No decide
// que se publica (eso ya lo filtro el trigger al insertar) ni como se agrupa (eso lo decide
// EventosOutboxDispatcher) — mismo criterio "tonto" que EventoRepository (DOC-010).
@Injectable()
export class EventosOutboxRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findPendientes(limite: number): Promise<EventoOutboxPendiente[]> {
    const resultado = await this.pool.query<{
      id: string;
      evento_id: string;
      tipo: string;
      sesion_id: string | null;
      organizacion_id: string | null;
    }>(
      `SELECT id, evento_id, tipo, sesion_id, organizacion_id
       FROM eventos_outbox
       WHERE publicado = false
       ORDER BY creado_en
       LIMIT $1`,
      [limite],
    );

    return resultado.rows.map((fila) => ({
      id: fila.id,
      eventoId: fila.evento_id,
      tipo: fila.tipo,
      sesionId: fila.sesion_id,
      organizacionId: fila.organizacion_id,
    }));
  }

  async marcarPublicados(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await this.pool.query(
      `UPDATE eventos_outbox
       SET publicado = true, publicado_en = now()
       WHERE id = ANY($1::text[])`,
      [ids],
    );
  }
}
