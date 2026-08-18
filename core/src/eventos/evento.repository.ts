import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type {
  RegistrarEventoContratoInput,
  RegistrarEventoInput,
} from './evento.types';

// DOC-010 — deliberadamente "tonto": registra lo que otros motores le piden, no decide cuando
// generarse un evento (esa decision vive en InventariosService/ActivoRepository).
@Injectable()
export class EventoRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async registrar(input: RegistrarEventoInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO eventos (id, activo_id, tipo, usuario, detalle)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        randomUUID(),
        input.activoId,
        input.tipo,
        input.usuario ?? null,
        input.detalle ? JSON.stringify(input.detalle) : null,
      ],
    );
  }

  // DOC-012 7 — evento sin activo asociado (eventos.activo_id nullable desde la migracion
  // 1755300000000).
  async registrarContrato(input: RegistrarEventoContratoInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO eventos (id, contrato_id, tipo, usuario, detalle)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        randomUUID(),
        input.contratoId,
        input.tipo,
        input.usuario ?? null,
        input.detalle ? JSON.stringify(input.detalle) : null,
      ],
    );
  }
}
