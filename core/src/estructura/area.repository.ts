import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import type { Area, NuevaAreaInput } from './area.types';

const FOREIGN_KEY_VIOLATION = '23503';

function esErrorPg(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

const SELECT_AREA_SQL = `
  SELECT id, organizacion_id AS "organizacionId", codigo, nombre, dependencia,
         centro_costo AS "centroCosto", responsable_id AS "responsableId",
         ubicacion_principal_id AS "ubicacionPrincipalId"
  FROM areas
`;

@Injectable()
export class AreaRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByOrganizacion(organizacionId: string): Promise<Area[]> {
    const result = await this.pool.query<Area>(
      `${SELECT_AREA_SQL} WHERE organizacion_id = $1 ORDER BY nombre`,
      [organizacionId],
    );
    return result.rows;
  }

  async crear(input: NuevaAreaInput): Promise<Area> {
    const id = randomUUID();
    try {
      await this.pool.query(
        `INSERT INTO areas (id, organizacion_id, codigo, nombre, dependencia, centro_costo)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          input.organizacionId,
          input.codigo,
          input.nombre,
          input.dependencia ?? null,
          input.centroCosto ?? null,
        ],
      );
    } catch (error: unknown) {
      if (esErrorPg(error) && error.code === FOREIGN_KEY_VIOLATION) {
        throw new BadRequestException({
          message: `organizacionId '${input.organizacionId}' inexistente`,
        });
      }
      throw error;
    }
    const result = await this.pool.query<Area>(
      `${SELECT_AREA_SQL} WHERE id = $1`,
      [id],
    );
    // Recien insertada con este mismo id — nunca undefined.
    return result.rows[0] as Area;
  }
}
