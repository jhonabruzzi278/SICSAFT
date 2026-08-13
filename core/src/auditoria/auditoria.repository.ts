import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type { RegistrarAuditoriaInput } from './auditoria.types';

// DOC-011 — invocado una vez por transaccion, siempre, desde el Orquestador (DOC-007). Nunca
// desde un motor individual, para no duplicar el registro si un motor falla a mitad de camino.
@Injectable()
export class AuditoriaRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO auditoria (id, usuario, equipo, ip, operacion, resultado, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        input.usuario,
        input.equipo ?? null,
        input.ip ?? null,
        input.operacion,
        input.resultado,
        input.observaciones ?? null,
      ],
    );
  }
}
